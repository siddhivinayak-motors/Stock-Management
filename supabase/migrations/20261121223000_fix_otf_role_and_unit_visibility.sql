-- OTF visibility: executives see only their own records; managers see their own
-- unit and assigned departments; all higher roles see all records in assigned
-- departments. When the creator is Super Admin (no city on profile), use the
-- OTF's own city as the unit fallback if it is populated.
drop policy if exists otf_order_books_select on public.otf_order_books;

create or replace function private.can_view_otf_record(
  p_department text,
  p_created_by uuid,
  p_record_city text
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.profiles viewer
    left join public.profiles creator on creator.user_id = p_created_by
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.deleted_at is null
      and private.can_access_department(p_department)
      and (
        viewer.is_super_admin is true
        or lower(trim(coalesce(viewer.designation, ''))) = 'super admin'
        or lower(trim(coalesce(viewer.designation, ''))) in ('admin', 'general manager')
        or (
          lower(trim(coalesce(viewer.designation, ''))) = 'manager'
          and nullif(trim(coalesce(viewer.city, '')), '') is not null
          and lower(trim(viewer.city)) = lower(trim(coalesce(
            nullif(trim(creator.city), ''),
            nullif(trim(p_record_city), '')
          )))
        )
        or (
          lower(trim(coalesce(viewer.designation, ''))) in ('executive', 'receptionist', 'reception', 'driver')
          and p_created_by = (select auth.uid())
        )
        or (
          lower(trim(coalesce(viewer.designation, ''))) not in (
            'super admin', 'admin', 'general manager', 'manager',
            'executive', 'receptionist', 'reception', 'driver'
          )
        )
      )
  );
$function$;

create policy otf_order_books_select
on public.otf_order_books
for select
to authenticated
using (
  (select private.can_view_otf_record(department, created_by, city))
  and (select private.has_permission('otf_management'::app_module, 'view'::app_action))
);

-- OTF view is a baseline capability for every active employee. Row visibility
-- remains restricted by the RLS function above and department access.
update public.employee_permissions ep
set actions = array_append(ep.actions, 'view'::app_action),
    updated_at = now()
from public.profiles p
where p.user_id = ep.user_id
  and ep.module = 'otf_management'::app_module
  and p.status = 'active'
  and p.deleted_at is null
  and not ('view'::app_action = any(ep.actions));

insert into public.employee_permissions (user_id, module, actions, granted_by)
select p.user_id, 'otf_management'::app_module, array['view'::app_action], null
from public.profiles p
where p.status = 'active'
  and p.deleted_at is null
  and not exists (
    select 1 from public.employee_permissions ep
    where ep.user_id = p.user_id
      and ep.module = 'otf_management'::app_module
  );
