-- Preserve any historical values, then remove unused vehicle fields from active quotations.
create table if not exists public.quotation_vehicle_legacy_archive (
  quotation_id uuid primary key references public.quotations(id) on delete cascade,
  legacy_chassis text,
  legacy_car_description text,
  archived_at timestamptz not null default now()
);

alter table public.quotation_vehicle_legacy_archive enable row level security;
revoke all on table public.quotation_vehicle_legacy_archive from anon, authenticated;

insert into public.quotation_vehicle_legacy_archive (quotation_id, legacy_chassis, legacy_car_description)
select id, chassis, car_description
from public.quotations
where nullif(btrim(coalesce(chassis, '')), '') is not null
   or nullif(btrim(coalesce(car_description, '')), '') is not null
on conflict (quotation_id) do update set
  legacy_chassis = excluded.legacy_chassis,
  legacy_car_description = excluded.legacy_car_description,
  archived_at = now();

alter table public.quotations
  drop column if exists chassis,
  drop column if exists car_description;
