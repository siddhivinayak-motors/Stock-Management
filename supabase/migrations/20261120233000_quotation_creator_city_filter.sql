alter table public.quotations add column if not exists creator_city text;

create or replace function private.sync_quotation_creator_city()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    select nullif(btrim(p.city), '')
      into new.creator_city
    from public.profiles p
    where p.user_id = new.created_by;
  else
    new.creator_city := null;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_quotation_creator_city() from public, anon, authenticated;

drop trigger if exists quotations_sync_creator_city on public.quotations;
create trigger quotations_sync_creator_city
before insert or update of created_by on public.quotations
for each row execute function private.sync_quotation_creator_city();

update public.quotations q
set creator_city = nullif(btrim(p.city), '')
from public.profiles p
where p.user_id = q.created_by
  and q.creator_city is distinct from nullif(btrim(p.city), '');

create index if not exists quotations_creator_city_department_idx
on public.quotations (department, creator_city, created_at desc);
