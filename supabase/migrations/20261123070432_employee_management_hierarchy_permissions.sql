create or replace function private.can_access_profile(p_target_user uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.profiles viewer
    join public.profiles target on target.user_id = p_target_user
    cross join lateral (
      select
        case
          when viewer.is_super_admin is true then 100
          when lower(trim(coalesce(viewer.designation,''))) = 'admin' then 90
          when lower(trim(coalesce(viewer.designation,''))) = 'general manager' then 80
          when lower(trim(coalesce(viewer.designation,''))) = 'manager' then 70
          when lower(trim(coalesce(viewer.designation,''))) in ('accountant','accounts') then 60
          when lower(trim(coalesce(viewer.designation,''))) = 'hr' then 50
          when lower(trim(coalesce(viewer.designation,''))) = 'dms' then 40
          when lower(trim(coalesce(viewer.designation,''))) = 'executive' then 30
          when lower(trim(coalesce(viewer.designation,''))) in ('reception','receptionist') then 20
          when lower(trim(coalesce(viewer.designation,''))) = 'driver' then 10
          else null
        end as viewer_level,
        case
          when target.is_super_admin is true then 100
          when lower(trim(coalesce(target.designation,''))) = 'admin' then 90
          when lower(trim(coalesce(target.designation,''))) = 'general manager' then 80
          when lower(trim(coalesce(target.designation,''))) = 'manager' then 70
          when lower(trim(coalesce(target.designation,''))) in ('accountant','accounts') then 60
          when lower(trim(coalesce(target.designation,''))) = 'hr' then 50
          when lower(trim(coalesce(target.designation,''))) = 'dms' then 40
          when lower(trim(coalesce(target.designation,''))) = 'executive' then 30
          when lower(trim(coalesce(target.designation,''))) in ('reception','receptionist') then 20
          when lower(trim(coalesce(target.designation,''))) = 'driver' then 10
          else null
        end as target_level
    ) hierarchy
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.deleted_at is null
      and target.status = 'active'
      and target.deleted_at is null
      and (
        viewer.is_super_admin is true
        or (
          hierarchy.viewer_level is not null
          and hierarchy.target_level is not null
          and hierarchy.target_level < hierarchy.viewer_level
          and (
            lower(trim(coalesce(viewer.designation,''))) in ('admin','general manager','hr')
            or (
              lower(trim(coalesce(viewer.designation,''))) = 'manager'
              and nullif(trim(coalesce(viewer.city,'')),'') is not null
              and lower(trim(coalesce(viewer.city,''))) = lower(trim(coalesce(target.city,'')))
              and exists (
                select 1
                from unnest(coalesce(target.department_access, array[]::text[]) || array[coalesce(target.department,'')]) target_dept
                where nullif(trim(target_dept),'') is not null
                  and lower(trim(target_dept)) = any (
                    select lower(trim(viewer_dept))
                    from unnest(coalesce(viewer.department_access, array[]::text[]) || array[coalesce(viewer.department,'')]) viewer_dept
                  )
              )
            )
          )
        )
      )
  );
$function$;

create or replace function private.has_permission(p_module app_module, p_action app_action)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.is_super_admin() or exists (
    select 1
    from public.employee_permissions ep
    join public.profiles p on p.user_id = ep.user_id
    where ep.user_id = (select auth.uid())
      and p.status = 'active'
      and p.deleted_at is null
      and ep.module = p_module
      and p_action = any(ep.actions)
      and (
        p_module::text <> 'employee_management'
        or lower(trim(coalesce(p.designation,''))) in ('admin','general manager','manager','hr')
      )
  );
$function$;
