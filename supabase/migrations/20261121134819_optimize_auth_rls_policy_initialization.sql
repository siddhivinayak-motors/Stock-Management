begin;

-- These policy rewrites preserve the existing role/department rules while
-- evaluating auth.uid() once per statement instead of once per row.
alter policy vehicles_delete_above_executive_only
on public.vehicles
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and (
        p.is_super_admin = true
        or p.designation = any(array['Manager','General Manager','Admin','HR','Accountant','DMS'])
      )
  )
);

alter policy vehicles_insert_above_executive_only
on public.vehicles
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and (
        p.is_super_admin = true
        or p.designation = any(array['Manager','General Manager','Admin','HR','Accountant','DMS'])
      )
  )
);

alter policy vehicles_edit_above_executive_only
on public.vehicles
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and (
        p.is_super_admin = true
        or p.designation = any(array['Manager','General Manager','Admin','HR','Accountant','DMS'])
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and (
        p.is_super_admin = true
        or p.designation = any(array['Manager','General Manager','Admin','HR','Accountant','DMS'])
      )
  )
);

alter policy stock_holds_manager_update_only
on public.stock_holds
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and (
        p.is_super_admin = true
        or p.designation = any(array['Manager','General Manager','Admin'])
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and (
        p.is_super_admin = true
        or p.designation = any(array['Manager','General Manager','Admin'])
      )
  )
);

alter policy quotations_manager_delete_only
on public.quotations
using (
  private.can_access_department(department)
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and (
        p.is_super_admin = true
        or p.designation = any(array['Manager','General Manager','Admin'])
      )
  )
);

alter policy quotation_items_delete_for_edit
on public.quotation_items
using (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and private.can_view_quotation_creator(q.created_by, q.department)
      and (
        private.has_permission('quotation_management'::public.app_module,'edit'::public.app_action)
        or (
          q.created_by = (select auth.uid())
          and private.has_permission('quotation_management'::public.app_module,'create'::public.app_action)
        )
      )
  )
);

commit;
