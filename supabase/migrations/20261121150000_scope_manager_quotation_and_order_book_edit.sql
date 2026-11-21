-- Manager scope for quotation book, order book and quotation management.
-- Managers can edit only records from their own city and assigned departments.

drop policy if exists quotations_update on public.quotations;
create policy quotations_update on public.quotations
for update to authenticated
using (
  private.can_view_quotation_creator(created_by, department)
  and private.has_permission('quotation_management'::app_module, 'edit'::app_action)
)
with check (
  private.can_view_quotation_creator(created_by, department)
  and private.has_permission('quotation_management'::app_module, 'edit'::app_action)
);

drop policy if exists quotation_items_select on public.quotation_items;
create policy quotation_items_select on public.quotation_items
for select to authenticated
using (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and private.can_view_quotation_creator(q.created_by, q.department)
  )
);

drop policy if exists quotation_items_insert on public.quotation_items;
create policy quotation_items_insert on public.quotation_items
for insert to authenticated
with check (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and private.can_view_quotation_creator(q.created_by, q.department)
      and (
        private.has_permission('quotation_management'::app_module, 'create'::app_action)
        or private.has_permission('quotation_management'::app_module, 'edit'::app_action)
      )
  )
);

drop policy if exists quotation_items_update on public.quotation_items;
create policy quotation_items_update on public.quotation_items
for update to authenticated
using (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and private.can_view_quotation_creator(q.created_by, q.department)
      and private.has_permission('quotation_management'::app_module, 'edit'::app_action)
  )
)
with check (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and private.can_view_quotation_creator(q.created_by, q.department)
      and private.has_permission('quotation_management'::app_module, 'edit'::app_action)
  )
);

drop policy if exists quotation_items_delete_for_edit on public.quotation_items;
create policy quotation_items_delete_for_edit on public.quotation_items
for delete to authenticated
using (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and private.can_view_quotation_creator(q.created_by, q.department)
      and private.has_permission('quotation_management'::app_module, 'edit'::app_action)
  )
);

update public.employee_permissions ep
set actions = case
  when 'edit'::app_action = any(ep.actions) then ep.actions
  else array_append(ep.actions, 'edit'::app_action)
end,
updated_at = now()
from public.profiles pr
where ep.user_id = pr.user_id
  and ep.module = 'quotation_management'
  and pr.status = 'active'
  and pr.deleted_at is null
  and lower(trim(coalesce(pr.designation,''))) = 'manager';
