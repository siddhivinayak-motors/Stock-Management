create or replace function private.can_access_department(p_department text)
returns boolean
language sql stable security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active' and p.deleted_at is null
      and (
        p.is_super_admin is true
        or lower(trim(coalesce(p.designation,''))) in ('admin','general manager')
        or lower(trim(coalesce(p_department,''))) = any (
          select lower(trim(x)) from unnest(coalesce(p.department_access, array[]::text[])) x
        )
        or lower(trim(coalesce(p_department,''))) = lower(trim(coalesce(p.department,'')))
      )
  );
$function$;

create or replace function private.can_access_profile(p_target_user uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $function$
 select exists (
  select 1 from public.profiles viewer
  join public.profiles target on target.user_id=p_target_user
  where viewer.user_id=(select auth.uid())
   and viewer.status='active' and viewer.deleted_at is null
   and target.status='active' and target.deleted_at is null
   and (
    viewer.is_super_admin is true
    or lower(trim(coalesce(viewer.designation,''))) in ('admin','general manager')
    or (
      lower(trim(coalesce(viewer.designation,'')))='manager'
      and nullif(trim(coalesce(viewer.city,'')),'') is not null
      and lower(trim(coalesce(viewer.city,'')))=lower(trim(coalesce(target.city,'')))
      and exists (
        select 1
        from unnest(coalesce(target.department_access, array[]::text[]) || array[coalesce(target.department,'')]) target_dept
        where nullif(trim(target_dept),'') is not null
          and lower(trim(target_dept)) = any (
            select lower(trim(viewer_dept))
            from unnest(coalesce(viewer.department_access,array[]::text[]) || array[coalesce(viewer.department,'')]) viewer_dept
          )
      )
    )
    or lower(trim(coalesce(viewer.designation,''))) in ('hr','dms','accountant','accounts')
   )
 );
$function$;

create or replace function private.can_view_quotation_creator(p_created_by uuid, p_department text)
returns boolean
language sql stable security definer
set search_path to ''
as $function$
 select exists (
  select 1
  from public.profiles viewer
  left join public.profiles creator on creator.user_id=p_created_by
  where viewer.user_id=(select auth.uid())
   and viewer.status='active' and viewer.deleted_at is null
   and private.can_access_department(p_department)
   and (
    viewer.is_super_admin is true
    or lower(trim(coalesce(viewer.designation,''))) in ('admin','general manager')
    or (
      lower(trim(coalesce(viewer.designation,'')))='manager'
      and nullif(trim(coalesce(viewer.city,'')),'') is not null
      and lower(trim(coalesce(viewer.city,'')))=lower(trim(coalesce(creator.city,'')))
    )
    or (
      lower(trim(coalesce(viewer.designation,''))) not in ('admin','general manager','manager','super admin')
      and p_created_by=(select auth.uid())
    )
   )
 );
$function$;

create or replace function private.can_view_otf_record(p_department text, p_created_by uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $function$
 select exists (
  select 1
  from public.profiles viewer
  left join public.profiles creator on creator.user_id=p_created_by
  where viewer.user_id=(select auth.uid())
   and viewer.status='active' and viewer.deleted_at is null
   and private.can_access_department(p_department)
   and (
    viewer.is_super_admin is true
    or lower(trim(coalesce(viewer.designation,''))) in ('admin','general manager')
    or (
      lower(trim(coalesce(viewer.designation,'')))='manager'
      and nullif(trim(coalesce(viewer.city,'')),'') is not null
      and lower(trim(coalesce(viewer.city,'')))=lower(trim(coalesce(creator.city,'')))
    )
    or (
      lower(trim(coalesce(viewer.designation,''))) not in ('admin','general manager','manager','super admin')
      and p_created_by=(select auth.uid())
    )
   )
 );
$function$;

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles for select to authenticated
using (private.can_access_department(department) and private.has_permission('stock_register'::app_module, 'view'::app_action));
