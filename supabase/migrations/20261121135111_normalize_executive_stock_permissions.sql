begin;

-- Executive users must not receive Stock Register edit/create/delete/approval
-- rights. They retain read access and may create hold requests only.
update public.employee_permissions ep
set actions = case
  when ep.module = 'stock_register'::public.app_module
    then array['view']::public.app_action[]
  when ep.module = 'stock_hold_management'::public.app_module
    then array['view','create']::public.app_action[]
end,
updated_at = now()
from public.profiles p
where p.user_id = ep.user_id
  and p.designation = 'Executive'
  and p.status = 'active'
  and p.deleted_at is null
  and ep.module in (
    'stock_register'::public.app_module,
    'stock_hold_management'::public.app_module
  )
  and ep.actions is distinct from case
    when ep.module = 'stock_register'::public.app_module
      then array['view']::public.app_action[]
    when ep.module = 'stock_hold_management'::public.app_module
      then array['view','create']::public.app_action[]
  end;

commit;
