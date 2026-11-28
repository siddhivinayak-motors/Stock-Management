CREATE SEQUENCE IF NOT EXISTS private.otf_order_number_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1
  NO CYCLE;

CREATE OR REPLACE FUNCTION private.next_otf_order_number(p_customer_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_customer text := upper(regexp_replace(trim(coalesce(p_customer_name,'')), '[[:space:]]+', ' ', 'g'));
  v_next bigint;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT private.has_permission('otf_management','create') THEN
    RAISE EXCEPTION 'OTF create permission required';
  END IF;
  IF v_customer = '' THEN
    RAISE EXCEPTION 'Customer name is required for OTF number';
  END IF;

  v_next := pg_catalog.nextval('private.otf_order_number_seq'::regclass);
  RETURN v_customer || ' - OTF' || CASE
    WHEN v_next < 1000 THEN pg_catalog.lpad(v_next::text,3,'0')
    ELSE v_next::text
  END;
END;
$function$;

REVOKE ALL ON FUNCTION private.next_otf_order_number(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.next_otf_order_number(text) FROM anon;
GRANT EXECUTE ON FUNCTION private.next_otf_order_number(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_otf_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  NEW.order_number := private.next_otf_order_number(NEW.customer_name);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_otf_order_number ON public.otf_order_books;
CREATE TRIGGER trg_assign_otf_order_number
BEFORE INSERT ON public.otf_order_books
FOR EACH ROW
EXECUTE FUNCTION public.assign_otf_order_number();
