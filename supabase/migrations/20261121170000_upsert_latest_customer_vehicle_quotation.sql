-- Reuse the latest quotation for the same department + customer mobile + model + variant.
-- This lets quotation creators refresh an existing quote without creating duplicate records.
create or replace function public.upsert_customer_vehicle_quotation(
  p_quote jsonb,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_department text := nullif(trim(p_quote->>'department'), '');
  v_phone text := regexp_replace(coalesce(p_quote->>'phone',''), '[^0-9]', '', 'g');
  v_model text := trim(coalesce(p_quote->>'model',''));
  v_variant text := trim(coalesce(p_quote->>'variant',''));
  v_row public.quotations%rowtype;
  v_updated boolean := false;
  v_new_quote_number text;
  v_item jsonb;
  v_line integer := 0;
begin
  if v_user is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not private.has_permission('quotation_management'::app_module, 'create'::app_action) then
    raise exception 'No quotation create permission.' using errcode = '42501';
  end if;
  if v_department is null or not private.can_access_department(v_department) then
    raise exception 'You do not have access to this quotation department.' using errcode = '42501';
  end if;
  if length(v_phone) <> 10 or v_model = '' then
    raise exception 'Enter a valid 10-digit mobile number and vehicle model.';
  end if;

  -- Match by mobile + same model and variant (colour/price may be refreshed).
  -- Only update a record visible to the current employee under existing city/department scope.
  select q.* into v_row
  from public.quotations q
  where lower(trim(q.department)) = lower(trim(v_department))
    and regexp_replace(coalesce(q.phone,''), '[^0-9]', '', 'g') = v_phone
    and lower(regexp_replace(trim(coalesce(q.model,'')), '\s+', ' ', 'g')) =
        lower(regexp_replace(trim(v_model), '\s+', ' ', 'g'))
    and lower(regexp_replace(trim(coalesce(q.variant,'')), '\s+', ' ', 'g')) =
        lower(regexp_replace(trim(v_variant), '\s+', ' ', 'g'))
    and private.can_view_quotation_creator(q.created_by, q.department)
  order by coalesce(q.updated_at, q.created_at) desc, q.created_at desc
  limit 1
  for update;

  if v_row.id is not null then
    update public.quotations set
      quote_date = nullif(p_quote->>'date','')::date,
      customer_name = coalesce(p_quote->>'customer', customer_name),
      phone = v_phone,
      address = nullif(p_quote->>'address',''),
      customer_gstin = nullif(p_quote->>'customerGstin',''),
      sales_mobile = nullif(p_quote->>'salesMobile',''),
      vehicle_count = coalesce(nullif(p_quote->>'vehicleNos','')::integer, 1),
      hypo = nullif(p_quote->>'hypo',''),
      model = v_model,
      variant = v_variant,
      colour = nullif(p_quote->>'colour',''),
      sales_person = nullif(p_quote->>'salesPerson',''),
      contact_person = nullif(p_quote->>'contactPerson',''),
      contact_mobile = nullif(p_quote->>'contactMobile',''),
      email = nullif(p_quote->>'email',''),
      branch_address = nullif(p_quote->>'branchAddress',''),
      helpline = nullif(p_quote->>'helpline',''),
      pan = nullif(p_quote->>'pan',''),
      gstin = nullif(p_quote->>'gstin',''),
      subtotal = coalesce(nullif(p_quote->>'subtotal','')::numeric, 0),
      discount = coalesce(nullif(p_quote->>'discount','')::numeric, 0),
      total = coalesce(nullif(p_quote->>'total','')::numeric, 0),
      amount_words = coalesce(p_quote->>'amountWords',''),
      terms = coalesce(p_quote->'terms','[]'::jsonb),
      bank_details = coalesce(p_quote->'bank','{}'::jsonb),
      status = 'Pending',
      approved_by = null,
      approved_at = null,
      updated_by = v_user,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
    v_updated := true;
    delete from public.quotation_items where quotation_id = v_row.id;
  else
    v_new_quote_number := public.next_quote_number(v_department);
    insert into public.quotations (
      quote_number, department, quote_date, customer_name, phone, address, customer_gstin, sales_mobile,
      vehicle_count, hypo, model, variant, colour, sales_person, contact_person, contact_mobile,
      email, branch_address, helpline, pan, gstin, subtotal, discount, total, amount_words,
      terms, bank_details, created_by, updated_by
    ) values (
      v_new_quote_number, v_department,
      nullif(p_quote->>'date','')::date, p_quote->>'customer', v_phone,
      nullif(p_quote->>'address',''), nullif(p_quote->>'customerGstin',''), nullif(p_quote->>'salesMobile',''),
      coalesce(nullif(p_quote->>'vehicleNos','')::integer, 1), nullif(p_quote->>'hypo',''),
      v_model, v_variant, nullif(p_quote->>'colour',''), nullif(p_quote->>'salesPerson',''),
      nullif(p_quote->>'contactPerson',''), nullif(p_quote->>'contactMobile',''),
      nullif(p_quote->>'email',''), nullif(p_quote->>'branchAddress',''), nullif(p_quote->>'helpline',''),
      nullif(p_quote->>'pan',''), nullif(p_quote->>'gstin',''),
      coalesce(nullif(p_quote->>'subtotal','')::numeric,0), coalesce(nullif(p_quote->>'discount','')::numeric,0),
      coalesce(nullif(p_quote->>'total','')::numeric,0), coalesce(p_quote->>'amountWords',''),
      coalesce(p_quote->'terms','[]'::jsonb), coalesce(p_quote->'bank','{}'::jsonb), v_user, v_user
    ) returning * into v_row;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb))
  loop
    v_line := v_line + 1;
    insert into public.quotation_items(quotation_id,line_no,particulars,amount,is_discount,is_custom)
    values (
      v_row.id, v_line, coalesce(v_item->>'name','Other'),
      coalesce(nullif(v_item->>'amount','')::numeric,0),
      coalesce((v_item->>'discount')::boolean,false),
      coalesce((v_item->>'custom')::boolean,false)
    );
  end loop;

  return jsonb_build_object('row', to_jsonb(v_row), 'updated_existing', v_updated);
end;
$$;

revoke all on function public.upsert_customer_vehicle_quotation(jsonb,jsonb) from public;
grant execute on function public.upsert_customer_vehicle_quotation(jsonb,jsonb) to authenticated;
