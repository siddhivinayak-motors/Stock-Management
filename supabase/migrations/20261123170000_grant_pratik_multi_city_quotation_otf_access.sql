-- Grant Pratik Badheka quotation and OTF visibility across Bhavnagar, Amreli and Botad.
-- His department scope remains Personal + EV only.

alter table public.profiles
  add column if not exists city_access text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname='profiles_city_access_allowed_check'
  ) then
    alter table public.profiles
      add constraint profiles_city_access_allowed_check
      check (city_access <@ array['Bhavnagar','Amreli','Botad','Rajula']::text[]);
  end if;
end $$;

create or replace function private.can_access_city(p_city text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.profiles viewer
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.deleted_at is null
      and (
        viewer.is_super_admin is true
        or lower(trim(coalesce(viewer.designation,''))) in ('admin','general manager')
        or lower(trim(coalesce(p_city,''))) = any (
          select lower(trim(x))
          from unnest(
            case
              when cardinality(coalesce(viewer.city_access, array[]::text[])) > 0
                then viewer.city_access
              else array[coalesce(viewer.city,'')]
            end
          ) as x
          where nullif(trim(x),'') is not null
        )
      )
  );
$function$;

create or replace function private.can_view_quotation_creator(p_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((
    select case
      when viewer.is_super_admin is true then true
      when lower(trim(coalesce(viewer.designation,''))) = 'manager' then
        private.can_access_city(creator.city)
      when lower(trim(coalesce(viewer.designation,''))) = any (
        array['admin','general manager','hr','dms','accountant','accounts']
      ) then true
      when lower(trim(coalesce(viewer.designation,''))) = any (
        array['executive','reception','receptionist','driver']
      ) then p_created_by = (select auth.uid())
      else false
    end
    from public.profiles viewer
    left join public.profiles creator on creator.user_id = p_created_by
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.deleted_at is null
  ), false);
$function$;

create or replace function private.can_view_quotation_creator(p_created_by uuid, p_department text)
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
        or lower(trim(coalesce(viewer.designation,''))) in ('admin','general manager')
        or (
          lower(trim(coalesce(viewer.designation,''))) = 'manager'
          and private.can_access_city(creator.city)
        )
        or (
          lower(trim(coalesce(viewer.designation,''))) not in ('admin','general manager','manager','super admin')
          and p_created_by = (select auth.uid())
        )
      )
  );
$function$;

create or replace function private.can_view_otf_record(p_department text, p_created_by uuid, p_record_city text)
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
          and private.can_access_city(coalesce(
            nullif(trim(creator.city), ''),
            nullif(trim(p_record_city), '')
          ))
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

create or replace function private.can_view_otf_record(p_department text, p_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.can_view_otf_record(p_department, p_created_by, null::text);
$function$;

update public.profiles
set city_access = array['Bhavnagar','Amreli','Botad']::text[],
    updated_at = now()
where user_id = '64a4977d-32ba-444f-a36f-22bdcfd41f4c'
  and full_name = 'PRATIK BADHEKA'
  and designation = 'Manager'
  and department_access @> array['Personal','EV']::text[];
