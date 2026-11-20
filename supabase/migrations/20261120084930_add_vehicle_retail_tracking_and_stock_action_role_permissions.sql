alter table public.vehicles
  add column if not exists retail_date date,
  add column if not exists retailed_by uuid references public.profiles(user_id);

alter table public.vehicles
  drop constraint if exists vehicles_stage_check;

alter table public.vehicles
  add constraint vehicles_stage_check
  check (stage = any (array['OPEN','HOLD','ALLOTED','DAMAGE','RETAIL']::text[]));

create index if not exists vehicles_retail_date_department_idx
  on public.vehicles (department, retail_date desc)
  where stage = 'RETAIL';

drop policy if exists vehicles_stock_role_update_gate on public.vehicles;
create policy vehicles_stock_role_update_gate
  on public.vehicles
  as restrictive
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.status = 'active'
        and (
          p.is_super_admin = true
          or p.designation = any (array['Super Admin','Admin','General Manager','Manager','HR','DMS','Accountant']::text[])
        )
    )
    or private.has_permission('common_excel_upload'::app_module, 'create'::app_action)
    or private.has_permission('backup_restore'::app_module, 'restore'::app_action)
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.status = 'active'
        and (
          p.is_super_admin = true
          or p.designation = any (array['Super Admin','Admin','General Manager','Manager','HR','DMS','Accountant']::text[])
        )
    )
    or private.has_permission('common_excel_upload'::app_module, 'create'::app_action)
    or private.has_permission('backup_restore'::app_module, 'restore'::app_action)
  );

drop policy if exists stock_holds_insert_role_gate on public.stock_holds;
create policy stock_holds_insert_role_gate
  on public.stock_holds
  as restrictive
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
