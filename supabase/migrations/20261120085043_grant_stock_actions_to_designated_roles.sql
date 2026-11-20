drop policy if exists holds_insert on public.stock_holds;
create policy holds_insert
  on public.stock_holds
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.status = 'active'
        and p.designation = any (array['Executive','Reception','Driver']::text[])
    )
    or private.has_permission('backup_restore'::app_module, 'restore'::app_action)
  );

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select
  on public.vehicles
  for select
  to authenticated
  using (
    private.has_permission('stock_register'::app_module, 'view'::app_action)
    or private.has_permission('backup_restore'::app_module, 'export'::app_action)
    or private.has_permission('backup_restore'::app_module, 'restore'::app_action)
    or exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.status = 'active'
        and (
          p.is_super_admin = true
          or p.designation = any (array['Super Admin','Admin','General Manager','Manager','HR','DMS','Accountant','Executive','Reception','Driver']::text[])
        )
    )
  );
