-- Keep legacy Super Admin designation profiles aligned with the app's role checks.
drop policy if exists stock_import_batches_manager_delete on public.stock_import_batches;
create policy stock_import_batches_manager_delete on public.stock_import_batches for delete to authenticated
using (
 private.can_access_department(department)
 and private.has_permission('common_excel_upload'::public.app_module,'view'::public.app_action)
 and (private.is_super_admin() or exists (
  select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.status='active' and p.deleted_at is null
  and lower(trim(coalesce(p.designation,''))) in ('super admin','admin','general manager','manager')
 ))
);
drop policy if exists otf_order_books_manager_delete on public.otf_order_books;
create policy otf_order_books_manager_delete on public.otf_order_books for delete to authenticated
using (
 status='CANCELLED'
 and private.can_view_otf_record(department,created_by,coalesce(nullif(btrim(unit_city),''),city))
 and private.has_permission('otf_management'::public.app_module,'view'::public.app_action)
 and (private.is_super_admin() or exists (
  select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.status='active' and p.deleted_at is null
  and lower(trim(coalesce(p.designation,''))) in ('super admin','admin','general manager','manager')
 ))
);