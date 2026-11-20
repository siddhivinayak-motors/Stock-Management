ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS created_by_name text;
UPDATE public.quotations q
SET created_by_name = p.full_name
FROM public.profiles p
WHERE q.created_by = p.user_id
  AND (q.created_by_name IS NULL OR btrim(q.created_by_name) = '');

CREATE OR REPLACE FUNCTION public.guard_duplicate_quotation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  IF length(v_phone) = 10 THEN
    v_key := jsonb_build_array(
      lower(regexp_replace(trim(coalesce(NEW.department, '')), '\s+', ' ', 'g')),
      lower(regexp_replace(trim(coalesce(NEW.customer_name, '')), '\s+', ' ', 'g')),
      v_phone,
      lower(regexp_replace(trim(coalesce(NEW.model, '')), '\s+', ' ', 'g')),
      lower(regexp_replace(trim(coalesce(NEW.variant, '')), '\s+', ' ', 'g')),
      round(coalesce(NEW.total, 0), 2)
    )::text;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_key, 0));
    IF EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE lower(regexp_replace(trim(coalesce(q.department, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(NEW.department, '')), '\s+', ' ', 'g'))
        AND lower(regexp_replace(trim(coalesce(q.customer_name, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(NEW.customer_name, '')), '\s+', ' ', 'g'))
        AND regexp_replace(coalesce(q.phone, ''), '[^0-9]', '', 'g') = v_phone
        AND lower(regexp_replace(trim(coalesce(q.model, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(NEW.model, '')), '\s+', ' ', 'g'))
        AND lower(regexp_replace(trim(coalesce(q.variant, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(NEW.variant, '')), '\s+', ' ', 'g'))
        AND round(q.total, 2) = round(coalesce(NEW.total, 0), 2)
    ) THEN
      RAISE EXCEPTION 'Duplicate quotation: same customer, mobile, vehicle and grand total already registered.'
        USING ERRCODE = '23505', CONSTRAINT = 'quotations_prevent_duplicate_customer_vehicle_total';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;