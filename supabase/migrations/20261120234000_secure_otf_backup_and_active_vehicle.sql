drop policy if exists otf_order_books_select on public.otf_order_books;
create policy otf_order_books_select on public.otf_order_books
for select to authenticated
using (
  private.can_access_department(department)
  and (private.can_view_quotation_creator(created_by)
       or private.has_permission('backup_restore'::app_module,'export'::app_action)
       or private.has_permission('backup_restore'::app_module,'restore'::app_action))
  and (private.has_permission('quotation_management'::app_module,'view'::app_action)
       or private.has_permission('backup_restore'::app_module,'export'::app_action)
       or private.has_permission('backup_restore'::app_module,'restore'::app_action))
);
drop policy if exists otf_order_books_insert on public.otf_order_books;
create policy otf_order_books_insert on public.otf_order_books
for insert to authenticated
with check (
  private.can_access_department(department)
  and (
    (created_by = (select auth.uid()) and private.has_permission('quotation_management'::app_module,'create'::app_action))
    or private.has_permission('backup_restore'::app_module,'restore'::app_action)
  )
);
drop policy if exists otf_order_books_update on public.otf_order_books;
create policy otf_order_books_update on public.otf_order_books
for update to authenticated
using (
  private.can_access_department(department)
  and (private.has_permission('quotation_management'::app_module,'edit'::app_action)
       or private.has_permission('backup_restore'::app_module,'restore'::app_action))
)
with check (
  private.can_access_department(department)
  and (private.has_permission('quotation_management'::app_module,'edit'::app_action)
       or private.has_permission('backup_restore'::app_module,'restore'::app_action))
);
create unique index if not exists otf_one_active_booking_per_vehicle_idx
on public.otf_order_books(vehicle_id) where status='BOOKED';