-- Restore canonical Super Admin access and normalize Executive least-privilege grants.
update public.profiles
set designation='Super Admin',
    is_super_admin=true,
    status='active',
    deleted_at=null,
    department_access=array['Personal','EV','Commercial','LLM']::text[],
    updated_at=now()
where user_id='236565a9-1892-41ee-b54a-c81bde3b9b01'::uuid;

insert into public.employee_permissions(user_id,module,actions,granted_by)
select '236565a9-1892-41ee-b54a-c81bde3b9b01'::uuid,m::public.app_module,
       array['view','create','edit','delete','approve','manage_users','export','restore']::public.app_action[],
       '236565a9-1892-41ee-b54a-c81bde3b9b01'::uuid
from unnest(array['dashboard','stock_register','stock_hold_management','price_list_management','quotation_management','employee_management','common_excel_upload','backup_restore','audit_history','retail_reports']) m
on conflict(user_id,module) do update
set actions=excluded.actions,granted_by=excluded.granted_by,updated_at=now();

delete from public.employee_permissions ep
using public.profiles p
where ep.user_id=p.user_id and p.designation='Executive'
  and p.status='active' and p.deleted_at is null
  and ep.module not in ('dashboard','stock_register','stock_hold_management','price_list_management','quotation_management','retail_reports');

insert into public.employee_permissions(user_id,module,actions,granted_by)
select p.user_id,v.module::public.app_module,v.actions::public.app_action[],
       '236565a9-1892-41ee-b54a-c81bde3b9b01'::uuid
from public.profiles p
cross join (values
 ('dashboard',array['view']::text[]),
 ('stock_register',array['view']::text[]),
 ('stock_hold_management',array['view','create']::text[]),
 ('price_list_management',array['view']::text[]),
 ('quotation_management',array['view','create','edit']::text[]),
 ('retail_reports',array['view']::text[])
) as v(module,actions)
where p.designation='Executive' and p.status='active' and p.deleted_at is null
on conflict(user_id,module) do update
set actions=excluded.actions,granted_by=excluded.granted_by,updated_at=now();
