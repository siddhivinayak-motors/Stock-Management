-- Allow Manager and higher designations to view complete Common Excel Upload history
-- across departments, while preserving existing department-scoped visibility for other users.
drop policy if exists stock_import_batches_manager_plus_select on public.stock_import_batches;
create policy stock_import_batches_manager_plus_select
on public.stock_import_batches
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and p.deleted_at is null
      and (
        p.is_super_admin is true
        or lower(trim(coalesce(p.designation, ''))) in ('manager', 'general manager', 'admin')
      )
  )
);
