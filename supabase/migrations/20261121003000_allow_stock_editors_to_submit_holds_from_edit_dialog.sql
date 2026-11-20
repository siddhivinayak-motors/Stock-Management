create policy holds_insert_stock_editors
on public.stock_holds
for insert
to authenticated
with check (
  private.has_permission('stock_register'::public.app_module,'edit'::public.app_action)
  or private.is_super_admin()
);
