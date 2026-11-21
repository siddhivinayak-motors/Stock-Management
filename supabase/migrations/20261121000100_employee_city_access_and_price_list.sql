alter table public.profiles
  add column if not exists city_access text[] not null default '{}'::text[];

update public.profiles
set city_access = case
  when cardinality(coalesce(city_access, '{}'::text[])) > 0 then city_access
  when city is not null and btrim(city) <> '' then array[city]::text[]
  else '{}'::text[]
end
where deleted_at is null;

-- Ensure Price List view is explicitly granted to every active employee.
-- Existing elevated actions are preserved; this migration only adds "view".
insert into public.employee_permissions (user_id, module, actions, granted_by)
select p.user_id, 'price_list_management', array['view']::text[],
       coalesce((select sp.user_id from public.profiles sp where sp.is_super_admin = true and sp.deleted_at is null limit 1), p.user_id)
from public.profiles p
where p.deleted_at is null
on conflict (user_id, module) do update
set actions = (
  select array_agg(distinct action order by action)
  from unnest(coalesce(public.employee_permissions.actions, '{}'::text[]) || array['view']::text[]) as action
);
