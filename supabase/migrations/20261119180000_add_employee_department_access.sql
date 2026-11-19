alter table public.profiles add column if not exists department_access text[] not null default '{}';

update public.profiles
set department_access = case
  when is_super_admin then array['Personal','EV','Commercial','LLM']::text[]
  when coalesce(department,'') <> '' and cardinality(department_access)=0 then array[department]::text[]
  else department_access
end;

create or replace function private.can_access_department(p_department text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_super_admin()
    or private.has_permission('employee_management'::public.app_module, 'manage_users'::public.app_action)
    or exists (
      select 1 from public.profiles p
      where p.user_id=(select auth.uid()) and p.status='active'
        and (
          lower(coalesce(p.department,''))=lower(coalesce(p_department,''))
          or exists (
            select 1 from unnest(coalesce(p.department_access,'{}'::text[])) d
            where lower(d)=lower(coalesce(p_department,''))
          )
        )
    );
$$;
revoke all on function private.can_access_department(text) from public;
grant execute on function private.can_access_department(text) to authenticated;
