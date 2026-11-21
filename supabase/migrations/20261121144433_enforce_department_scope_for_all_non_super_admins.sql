create or replace function private.can_access_department(p_department text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and p.deleted_at is null
      and (
        p.is_super_admin is true
        or lower(trim(coalesce(p_department,''))) = any (
          select lower(trim(x))
          from unnest(coalesce(p.department_access, array[]::text[])) x
        )
        or lower(trim(coalesce(p_department,''))) = lower(trim(coalesce(p.department,'')))
      )
  );
$function$;