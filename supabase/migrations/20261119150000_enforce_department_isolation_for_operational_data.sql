create or replace function private.can_access_department(p_department text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_super_admin()
    or private.has_permission('employee_management'::public.app_module, 'manage_users'::public.app_action)
    or exists (
      select 1 from public.profiles p
      where p.user_id=(select auth.uid()) and p.status='active'
        and lower(coalesce(p.department,''))=lower(coalesce(p_department,''))
    );
$$;
revoke all on function private.can_access_department(text) from public;
grant execute on function private.can_access_department(text) to authenticated;

drop policy if exists department_isolation_vehicles on public.vehicles;
create policy department_isolation_vehicles on public.vehicles as restrictive for all to authenticated
using (private.can_access_department(department)) with check (private.can_access_department(department));
drop policy if exists department_isolation_stock_holds on public.stock_holds;
create policy department_isolation_stock_holds on public.stock_holds as restrictive for all to authenticated
using (private.can_access_department(department)) with check (private.can_access_department(department));
drop policy if exists department_isolation_quotations on public.quotations;
create policy department_isolation_quotations on public.quotations as restrictive for all to authenticated
using (private.can_access_department(department)) with check (private.can_access_department(department));
drop policy if exists department_isolation_stock_import_batches on public.stock_import_batches;
create policy department_isolation_stock_import_batches on public.stock_import_batches as restrictive for all to authenticated
using (private.can_access_department(department)) with check (private.can_access_department(department));
drop policy if exists department_isolation_price_list_versions on public.price_list_versions;
create policy department_isolation_price_list_versions on public.price_list_versions as restrictive for all to authenticated
using (private.can_access_department(department)) with check (private.can_access_department(department));
drop policy if exists department_isolation_price_list_items on public.price_list_items;
create policy department_isolation_price_list_items on public.price_list_items as restrictive for all to authenticated
using (private.can_access_department(department)) with check (private.can_access_department(department));
drop policy if exists department_isolation_quotation_items on public.quotation_items;
create policy department_isolation_quotation_items on public.quotation_items as restrictive for all to authenticated
using (exists(select 1 from public.quotations q where q.id=quotation_id and private.can_access_department(q.department)))
with check (exists(select 1 from public.quotations q where q.id=quotation_id and private.can_access_department(q.department)));
