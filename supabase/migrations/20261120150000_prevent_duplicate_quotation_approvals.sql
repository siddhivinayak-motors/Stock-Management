CREATE OR REPLACE FUNCTION public.guard_duplicate_quotation_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phone text;
  v_key text;
BEGIN
  IF lower(coalesce(NEW.status, '')) <> 'approved'
     OR lower(coalesce(OLD.status, '')) = 'approved' THEN
    RETURN NEW;
  END IF;
  v_phone := regexp_replace(coalesce(NEW.phone, ''), '[^0-9]', '', 'g');
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
      WHERE q.id <> NEW.id
        AND lower(coalesce(q.status, '')) = 'approved'
        AND lower(regexp_replace(trim(coalesce(q.department, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(NEW.department, '')), '\s+', ' ', 'g'))
        AND lower(regexp_replace(trim(coalesce(q.customer_name, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(NEW.customer_name, '')), '\s+', ' ', 'g'))
        AND regexp_replace(coalesce(q.phone, ''), '[^0-9]', '', 'g') = v_phone
        AND lower(regexp_replace(trim(coalesce(q.model, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(NEW.model, '')), '\s+', ' ', 'g'))
        AND lower(regexp_replace(trim(coalesce(q.variant, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(NEW.variant, '')), '\s+', ' ', 'g'))
        AND round(q.total, 2) = round(coalesce(NEW.total, 0), 2)
    ) THEN
      RAISE EXCEPTION 'This quotation is a duplicate of an already approved quotation.'
        USING ERRCODE = '23505', CONSTRAINT = 'quotations_prevent_duplicate_approval';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS quotations_guard_duplicate_approval ON public.quotations;
CREATE TRIGGER quotations_guard_duplicate_approval
BEFORE UPDATE OF status ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.guard_duplicate_quotation_approval();