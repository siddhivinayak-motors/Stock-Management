CREATE SEQUENCE IF NOT EXISTS private.svm_quote_number_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1
  NO CYCLE;

CREATE OR REPLACE FUNCTION private.next_quote_number(p_department text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_department text := CASE upper(trim(coalesce(p_department,'')))
    WHEN 'PERSONAL' THEN 'Personal'
    WHEN 'PV' THEN 'Personal'
    WHEN 'EV' THEN 'EV'
    WHEN 'COMMERCIAL' THEN 'Commercial'
    WHEN 'CV' THEN 'Commercial'
    WHEN 'LLM' THEN 'LLM'
    WHEN 'LV' THEN 'LLM'
    ELSE NULL
  END;
  v_next bigint;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT private.has_permission('quotation_management','create') THEN
    RAISE EXCEPTION 'Quotation create permission required';
  END IF;
  IF v_department IS NULL THEN
    RAISE EXCEPTION 'Invalid quotation department';
  END IF;

  v_next := pg_catalog.nextval('private.svm_quote_number_seq'::regclass);
  RETURN 'SVM' || CASE WHEN v_next < 1000 THEN pg_catalog.lpad(v_next::text,3,'0') ELSE v_next::text END;
END;
$function$;

CREATE OR REPLACE FUNCTION private.next_quote_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_next bigint;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT private.has_permission('quotation_management','create') THEN
    RAISE EXCEPTION 'Quotation create permission required';
  END IF;

  v_next := pg_catalog.nextval('private.svm_quote_number_seq'::regclass);
  RETURN 'SVM' || CASE WHEN v_next < 1000 THEN pg_catalog.lpad(v_next::text,3,'0') ELSE v_next::text END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_duplicate_quotation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_phone text;
  v_key text;
BEGIN
  v_phone := regexp_replace(coalesce(NEW.phone, ''), '[^0-9]', '', 'g');

  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
    SELECT p.full_name INTO NEW.created_by_name
    FROM public.profiles p
    WHERE p.user_id = auth.uid();
  END IF;

  -- The authorized quotation RPC sets this transaction-local flag for a new
  -- quotation. Direct table inserts retain the existing duplicate protection.
  IF length(v_phone) = 10
     AND current_setting('app.allow_duplicate_quotation', true) IS DISTINCT FROM 'on' THEN
    v_key := jsonb_build_array(
      lower(regexp_replace(trim(coalesce(NEW.department, '')), '[[:space:]]+', ' ', 'g')),
      lower(regexp_replace(trim(coalesce(NEW.customer_name, '')), '[[:space:]]+', ' ', 'g')),
      v_phone,
      lower(regexp_replace(trim(coalesce(NEW.model, '')), '[[:space:]]+', ' ', 'g')),
      lower(regexp_replace(trim(coalesce(NEW.variant, '')), '[[:space:]]+', ' ', 'g')),
      round(coalesce(NEW.total, 0), 2)
    )::text;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key, 0));

    IF EXISTS (
      SELECT 1
      FROM public.quotations q
      WHERE lower(regexp_replace(trim(coalesce(q.department, '')), '[[:space:]]+', ' ', 'g')) =
            lower(regexp_replace(trim(coalesce(NEW.department, '')), '[[:space:]]+', ' ', 'g'))
        AND lower(regexp_replace(trim(coalesce(q.customer_name, '')), '[[:space:]]+', ' ', 'g')) =
            lower(regexp_replace(trim(coalesce(NEW.customer_name, '')), '[[:space:]]+', ' ', 'g'))
        AND regexp_replace(coalesce(q.phone, ''), '[^0-9]', '', 'g') = v_phone
        AND lower(regexp_replace(trim(coalesce(q.model, '')), '[[:space:]]+', ' ', 'g')) =
            lower(regexp_replace(trim(coalesce(NEW.model, '')), '[[:space:]]+', ' ', 'g'))
        AND lower(regexp_replace(trim(coalesce(q.variant, '')), '[[:space:]]+', ' ', 'g')) =
            lower(regexp_replace(trim(coalesce(NEW.variant, '')), '[[:space:]]+', ' ', 'g'))
        AND round(q.total, 2) = round(coalesce(NEW.total, 0), 2)
    ) THEN
      RAISE EXCEPTION 'Duplicate quotation: same customer, mobile, vehicle and grand total already registered.'
        USING ERRCODE = '23505', CONSTRAINT = 'quotations_prevent_duplicate_customer_vehicle_total';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_customer_vehicle_quotation(
  p_quote jsonb,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_department text := nullif(trim(p_quote->>'department'), '');
  v_phone text := regexp_replace(coalesce(p_quote->>'phone',''), '[^0-9]', '', 'g');
  v_customer_name text := regexp_replace(trim(coalesce(p_quote->>'customer','')), '[[:space:]]+', ' ', 'g');
  v_model text := trim(coalesce(p_quote->>'model',''));
  v_variant text := trim(coalesce(p_quote->>'variant',''));
  v_assigned_user uuid;
  v_assigned_name text;
  v_viewer_role text;
  v_viewer_city text;
  v_row public.quotations%rowtype;
  v_new_quote_number text;
  v_item jsonb;
  v_line integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING errcode = '42501';
  END IF;
  IF NOT private.has_permission('quotation_management'::app_module, 'create'::app_action) THEN
    RAISE EXCEPTION 'No quotation create permission.' USING errcode = '42501';
  END IF;
  IF v_department IS NULL OR NOT private.can_access_department(v_department) THEN
    RAISE EXCEPTION 'You do not have access to this quotation department.' USING errcode = '42501';
  END IF;
  IF v_customer_name = '' THEN
    RAISE EXCEPTION 'Enter a customer name.';
  END IF;
  IF length(v_phone) <> 10 OR v_model = '' THEN
    RAISE EXCEPTION 'Enter a valid 10-digit mobile number and vehicle model.';
  END IF;

  v_assigned_user := coalesce(nullif(p_quote->>'salesConsultantId','')::uuid, v_user);
  SELECT lower(trim(coalesce(p.designation,''))), coalesce(p.city,'')
    INTO v_viewer_role, v_viewer_city
  FROM public.profiles p
  WHERE p.user_id = v_user AND p.status = 'active' AND p.deleted_at IS NULL;

  IF v_assigned_user <> v_user THEN
    IF NOT (
      v_viewer_role IN ('manager','general manager','admin','super admin')
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=v_user AND p.is_super_admin IS TRUE)
    ) THEN
      RAISE EXCEPTION 'Only Manager, General Manager, Admin and Super Admin can change the Sales Consultant.' USING errcode = '42501';
    END IF;

    SELECT p.full_name INTO v_assigned_name
    FROM public.profiles p
    WHERE p.user_id = v_assigned_user
      AND p.designation = 'Executive'
      AND p.status = 'active'
      AND p.deleted_at IS NULL
      AND (
        lower(trim(coalesce(p.department,''))) = lower(trim(v_department))
        OR EXISTS (
          SELECT 1 FROM unnest(coalesce(p.department_access,array[]::text[])) d
          WHERE lower(trim(d)) = lower(trim(v_department))
        )
      )
      AND (v_viewer_role <> 'manager' OR private.can_access_city(p.city))
    LIMIT 1;

    IF v_assigned_name IS NULL THEN
      RAISE EXCEPTION 'Selected Sales Consultant is not an active Executive assigned to this department and accessible city.' USING errcode = '42501';
    END IF;
  ELSE
    SELECT coalesce(p.full_name, p.email) INTO v_assigned_name
    FROM public.profiles p
    WHERE p.user_id = v_user AND p.status = 'active' AND p.deleted_at IS NULL;
  END IF;

  -- Serialize same customer/vehicle submissions while still creating a new
  -- quotation row and a fresh global SVM number for every Save action.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    jsonb_build_array(
      lower(trim(v_department)),
      v_phone,
      lower(regexp_replace(trim(v_model), '[[:space:]]+', ' ', 'g')),
      lower(regexp_replace(trim(v_variant), '[[:space:]]+', ' ', 'g'))
    )::text,
    0
  ));

  v_new_quote_number := upper(v_customer_name) || ' - ' || private.next_quote_number(v_department);

  -- Allow duplicate customer/vehicle/amount quotations only through this
  -- permission-checked RPC. The trigger's direct-insert guard stays active.
  PERFORM pg_catalog.set_config('app.allow_duplicate_quotation', 'on', true);

  INSERT INTO public.quotations (
    quote_number, department, quote_date, customer_name, phone, address, customer_gstin, sales_mobile,
    vehicle_count, hypo, model, variant, colour, sales_person, contact_person, contact_mobile,
    email, branch_address, helpline, pan, gstin, subtotal, discount, total, amount_words,
    terms, bank_details, created_by, created_by_name, updated_by
  ) VALUES (
    v_new_quote_number, v_department,
    nullif(p_quote->>'date','')::date, v_customer_name, v_phone,
    nullif(p_quote->>'address',''), nullif(p_quote->>'customerGstin',''), nullif(p_quote->>'salesMobile',''),
    coalesce(nullif(p_quote->>'vehicleNos','')::integer, 1), nullif(p_quote->>'hypo',''),
    v_model, v_variant, nullif(p_quote->>'colour',''), v_assigned_name,
    nullif(p_quote->>'contactPerson',''), nullif(p_quote->>'contactMobile',''),
    nullif(p_quote->>'email',''), nullif(p_quote->>'branchAddress',''), nullif(p_quote->>'helpline',''),
    nullif(p_quote->>'pan',''), nullif(p_quote->>'gstin',''),
    coalesce(nullif(p_quote->>'subtotal','')::numeric,0), coalesce(nullif(p_quote->>'discount','')::numeric,0),
    greatest(0, coalesce(nullif(p_quote->>'subtotal','')::numeric,0) - coalesce(nullif(p_quote->>'discount','')::numeric,0)),
    coalesce(p_quote->>'amountWords',''),
    coalesce(p_quote->'terms','[]'::jsonb), coalesce(p_quote->'bank','{}'::jsonb),
    v_assigned_user, v_assigned_name, v_user
  )
  RETURNING * INTO v_row;

  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_items,'[]'::jsonb))
  LOOP
    v_line := v_line + 1;
    INSERT INTO public.quotation_items(quotation_id,line_no,particulars,amount,is_discount,is_custom)
    VALUES (
      v_row.id,
      v_line,
      coalesce(v_item->>'name','Other'),
      coalesce(nullif(v_item->>'amount','')::numeric,0),
      coalesce((v_item->>'discount')::boolean,false),
      coalesce((v_item->>'custom')::boolean,false)
    );
  END LOOP;

  RETURN jsonb_build_object('row', to_jsonb(v_row), 'updated_existing', false);
END;
$function$;
