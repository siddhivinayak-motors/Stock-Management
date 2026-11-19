-- Keep the audit INSERT policy fully schema-qualified for consistent resolution.
DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
CREATE POLICY audit_insert
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = (SELECT auth.uid())
  AND NOT (SELECT private.is_super_admin())
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.status = 'active'
      AND p.is_super_admin = false
  )
);
