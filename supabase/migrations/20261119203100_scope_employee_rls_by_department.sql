-- Department-scope employee directory and employee permission policies.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  user_id=(select auth.uid()) or private.is_super_admin()
  or (private.has_permission('employee_management'::public.app_module,'view'::public.app_action)
      and private.can_access_department(department))
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (
  private.is_super_admin()
  or ((private.has_permission('employee_management'::public.app_module,'edit'::public.app_action)
       or private.has_permission('employee_management'::public.app_module,'manage_users'::public.app_action))
      and private.can_access_department(department))
)
with check (
  private.is_super_admin()
  or ((private.has_permission('employee_management'::public.app_module,'edit'::public.app_action)
       or private.has_permission('employee_management'::public.app_module,'manage_users'::public.app_action))
      and private.can_access_department(department))
);

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
using (
  private.is_super_admin()
  or (private.has_permission('employee_management'::public.app_module,'delete'::public.app_action)
      and private.can_access_department(department))
);

drop policy if exists permissions_select on public.employee_permissions;
create policy permissions_select on public.employee_permissions for select to authenticated
using (
  user_id=(select auth.uid()) or private.is_super_admin()
  or (private.has_permission('employee_management'::public.app_module,'view'::public.app_action)
      and exists (select 1 from public.profiles target
                  where target.user_id=employee_permissions.user_id
                    and private.can_access_department(target.department)))
);

drop policy if exists permissions_insert on public.employee_permissions;
create policy permissions_insert on public.employee_permissions for insert to authenticated
with check (
  private.is_super_admin()
  or (private.has_permission('employee_management'::public.app_module,'manage_users'::public.app_action)
      and user_id<>(select auth.uid())
      and exists (select 1 from public.profiles target
                  where target.user_id=employee_permissions.user_id
                    and private.can_access_department(target.department)))
);

drop policy if exists permissions_update on public.employee_permissions;
create policy permissions_update on public.employee_permissions for update to authenticated
using (
  private.is_super_admin()
  or (private.has_permission('employee_management'::public.app_module,'manage_users'::public.app_action)
      and user_id<>(select auth.uid())
      and exists (select 1 from public.profiles target
                  where target.user_id=employee_permissions.user_id
                    and private.can_access_department(target.department)))
)
with check (
  private.is_super_admin()
  or (private.has_permission('employee_management'::public.app_module,'manage_users'::public.app_action)
      and user_id<>(select auth.uid())
      and exists (select 1 from public.profiles target
                  where target.user_id=employee_permissions.user_id
                    and private.can_access_department(target.department)))
);

drop policy if exists permissions_delete on public.employee_permissions;
create policy permissions_delete on public.employee_permissions for delete to authenticated
using (
  private.is_super_admin()
  or (private.has_permission('employee_management'::public.app_module,'manage_users'::public.app_action)
      and user_id<>(select auth.uid())
      and exists (select 1 from public.profiles target
                  where target.user_id=employee_permissions.user_id
                    and private.can_access_department(target.department)))
);
