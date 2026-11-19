-- Repair audit writes while preserving the Super Admin exclusion and RLS rules.
ALTER TYPE public.app_action ADD VALUE IF NOT EXISTS 'login';
ALTER TYPE public.app_action ADD VALUE IF NOT EXISTS 'logout';

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_designation text;

GRANT INSERT ON TABLE public.audit_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.log_activity(
  p_module public.app_module,
  p_action public.app_action,
  p_label text,
  p_record_type text DEFAULT NULL::text,
  p_record_id text DEFAULT NULL::text,
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS bigint
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_id bigint;
  v_actor uuid := (SELECT auth.uid());
  v_email text;
  v_designation text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Super Admin activity must never enter the application audit table.
  IF (SELECT private.is_super_admin()) THEN
    RETURN NULL;
  END IF;

  SELECT p.email, p.designation
    INTO v_email, v_designation
  FROM public.profiles p
  WHERE p.user_id = v_actor
    AND p.status = 'active'
    AND p.is_super_admin = false;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Active non-super-admin employee profile required';
  END IF;

  INSERT INTO public.audit_logs(
    actor_id, actor_email, actor_designation, module, action, action_label,
    record_type, record_id, details
  )
  VALUES (
    v_actor, v_email, v_designation, p_module, p_action, p_label,
    p_record_type, p_record_id, COALESCE(p_details, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.log_activity(public.app_module, public.app_action, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(public.app_module, public.app_action, text, text, text, jsonb) TO authenticated;
