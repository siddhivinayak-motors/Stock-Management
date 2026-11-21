begin;

-- Non-admin users keep read-only access to price data for quotations.
update public.employee_permissions ep
set actions = array['view']::public.app_action[],
    updated_at = now()
from public.profiles p
where p.user_id = ep.user_id
  and ep.module = 'price_list_management'::public.app_module
  and not (
    p.is_super_admin = true
    or p.designation = any(array['Admin','General Manager'])
  )
  and ep.actions is distinct from array['view']::public.app_action[];

-- Backup & Restore permissions are reserved for the unique Super Admin.
delete from public.employee_permissions ep
using public.profiles p
where p.user_id = ep.user_id
  and ep.module = 'backup_restore'::public.app_module
  and p.is_super_admin is distinct from true;

-- Admin-tier gate for Price List writes.
drop policy if exists price_list_versions_admin_insert_gate on public.price_list_versions;
create policy price_list_versions_admin_insert_gate
on public.price_list_versions as restrictive
for insert to authenticated
with check (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
);

drop policy if exists price_list_versions_admin_update_gate on public.price_list_versions;
create policy price_list_versions_admin_update_gate
on public.price_list_versions as restrictive
for update to authenticated
using (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
)
with check (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
);

drop policy if exists price_list_versions_admin_delete_gate on public.price_list_versions;
create policy price_list_versions_admin_delete_gate
on public.price_list_versions as restrictive
for delete to authenticated
using (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
);

drop policy if exists price_list_items_admin_insert_gate on public.price_list_items;
create policy price_list_items_admin_insert_gate
on public.price_list_items as restrictive
for insert to authenticated
with check (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
);

drop policy if exists price_list_items_admin_update_gate on public.price_list_items;
create policy price_list_items_admin_update_gate
on public.price_list_items as restrictive
for update to authenticated
using (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
)
with check (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
);

drop policy if exists price_list_items_admin_delete_gate on public.price_list_items;
create policy price_list_items_admin_delete_gate
on public.price_list_items as restrictive
for delete to authenticated
using (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
);

-- Price List import batches and staged rows are Admin-tier only.
drop policy if exists price_list_import_batches_admin_gate on public.price_list_import_batches;
create policy price_list_import_batches_admin_gate
on public.price_list_import_batches as restrictive
for all to authenticated
using (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
)
with check (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
);

drop policy if exists price_list_import_items_admin_gate on public.price_list_import_items;
create policy price_list_import_items_admin_gate
on public.price_list_import_items as restrictive
for all to authenticated
using (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
)
with check (
  private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
);

-- Original Price List Excel files are Admin-tier only.
drop policy if exists price_list_files_admin_gate on storage.objects;
create policy price_list_files_admin_gate
on storage.objects as restrictive
for all to authenticated
using (
  bucket_id <> 'price-list-files'
  or private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
)
with check (
  bucket_id <> 'price-list-files'
  or private.is_super_admin()
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.status='active' and p.designation=any(array['Admin','General Manager']))
);

commit;
