-- Grant Pratik Badheka the employee-create action only.
-- Existing view permission is preserved; edit, delete and manage_users are not granted.
update public.employee_permissions ep
set actions = (
  select array_agg(distinct action order by action)
  from unnest(ep.actions || array['create'::public.app_action]) action
), updated_at = now()
from public.profiles p
where p.user_id=ep.user_id
  and lower(p.email)='sales.b@siddhivinayakmotors.com'
  and p.full_name ilike 'PRATIK BADHEKA'
  and p.status='active'
  and p.is_super_admin=false
  and ep.module='employee_management'::public.app_module;
