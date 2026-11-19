create or replace function private.can_access_department(p_department text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_super_admin()
    or private.has_permission('employee_management'::public.app_module, 'manage_users'::public.app_action)
    or exists (
      select 1 from public.profiles p
      where p.user_id=(select auth.uid()) and p.status='active'
        and case
          when cardinality(coalesce(p.department_access,'{}'::text[])) > 0 then exists (
            select 1 from unnest(p.department_access) d
            where lower(d)=lower(coalesce(p_department,''))
          )
          else lower(coalesce(p.department,''))=lower(coalesce(p_department,''))
        end
    );
$$;
revoke all on function private.can_access_department(text) from public;
grant execute on function private.can_access_department(text) to authenticated;
