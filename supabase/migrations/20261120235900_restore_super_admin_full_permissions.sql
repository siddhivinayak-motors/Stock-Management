-- Restore the canonical Super Admin profile and explicit module grants.
-- This is idempotent and scoped to the existing Super Admin account only.
update public.profiles
set designation = 'Super Admin',
    is_super_admin = true,
    status = 'active',
    deleted_at = null,
    department_access = array['Personal','EV','Commercial','LLM']::text[],
    updated_at = now()
where user_id = '236565a9-1892-41ee-b54a-c81bde3b9b01'::uuid;

insert into public.employee_permissions (user_id, module, actions, granted_by)
select
  '236565a9-1892-41ee-b54a-c81bde3b9b01'::uuid,
  m::public.app_module,
  array['view','create','edit','delete','approve','manage_users','export','restore']::public.app_action[],
  '236565a9-1892-41ee-b54a-c81bde3b9b01'::uuid
from unnest(array[
  'dashboard','stock_register','stock_hold_management','price_list_management',
  'quotation_management','employee_management','common_excel_upload',
  'backup_restore','audit_history','retail_reports'
]) as m
on conflict (user_id, module) do update
set actions = excluded.actions,
    granted_by = excluded.granted_by,
    updated_at = now();
