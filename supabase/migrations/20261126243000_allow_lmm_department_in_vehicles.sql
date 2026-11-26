-- Allow the canonical LMM department value in vehicles.
-- Preserve all existing supported department values.
alter table public.vehicles
  drop constraint if exists vehicles_department_check;

alter table public.vehicles
  add constraint vehicles_department_check
  check (department = any (array['Personal'::text, 'EV'::text, 'Commercial'::text, 'LMM'::text]));
