alter table public.vehicles
  drop constraint if exists vehicles_stage_check;

alter table public.vehicles
  add constraint vehicles_stage_check
  check (stage = any (array['OPEN','HOLD','ALLOTED','DAMAGE','RETAIL','DEMO','TRANSFER_OUT','OTHER']::text[]));

create table if not exists public.vehicle_exit_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  department text not null check (department = any (array['Personal','EV','Commercial','LLM']::text[])),
  exit_type text not null check (exit_type = any (array['RETAIL','DEMO','DAMAGE','TRANSFER_OUT','OTHER']::text[])),
  exit_date date not null default current_date,
  reason text,
  destination text,
  customer_name text,
  sc_name text,
  created_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  vehicle_snapshot jsonb not null default '{}'::jsonb
);

create index if not exists vehicle_exit_records_date_department_idx
  on public.vehicle_exit_records (exit_date desc, department);
create index if not exists vehicle_exit_records_type_date_idx
  on public.vehicle_exit_records (exit_type, exit_date desc);
create index if not exists vehicle_exit_records_vehicle_idx
  on public.vehicle_exit_records (vehicle_id, created_at desc);

alter table public.vehicle_exit_records enable row level security;

drop policy if exists vehicle_exit_records_select on public.vehicle_exit_records;
create policy vehicle_exit_records_select
  on public.vehicle_exit_records
  for select to authenticated
  using (
    private.has_permission('retail_reports'::app_module, 'view'::app_action)
    and private.has_permission('stock_register'::app_module, 'view'::app_action)
  );

drop policy if exists vehicle_exit_records_insert on public.vehicle_exit_records;
create policy vehicle_exit_records_insert
  on public.vehicle_exit_records
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.has_permission('stock_register'::app_module, 'view'::app_action)
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.status = 'active'
        and (
          p.is_super_admin = true
          or p.designation = any (array['Super Admin','Admin','General Manager','Manager','HR','DMS','Accountant']::text[])
        )
    )
  );

grant select, insert on public.vehicle_exit_records to authenticated;
revoke update, delete on public.vehicle_exit_records from anon, authenticated;

create or replace function public.register_vehicle_exit(
  p_vehicle_id uuid,
  p_exit_type text,
  p_exit_date date default current_date,
  p_reason text default null,
  p_destination text default null,
  p_customer_name text default null,
  p_notes text default null
)
returns public.vehicle_exit_records
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_vehicle public.vehicles%rowtype;
  v_record public.vehicle_exit_records%rowtype;
  v_stage text;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.';
  end if;
  if upper(coalesce(p_exit_type,'')) not in ('RETAIL','DEMO','DAMAGE','TRANSFER_OUT','OTHER') then
    raise exception 'Invalid vehicle exit type.';
  end if;
  if p_exit_date is null then
    raise exception 'Exit date is required.';
  end if;
  if upper(p_exit_type) <> 'RETAIL' and coalesce(trim(p_reason),'') = '' then
    raise exception 'Please enter the reason for this stock exit.';
  end if;
  select * into v_vehicle from public.vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'Vehicle not found or you do not have access to it.'; end if;
  if v_vehicle.stage not in ('OPEN','ALLOTED','HOLD') then
    raise exception 'This vehicle is not in an active stock stage and cannot be exited again.';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and (
        p.is_super_admin = true
        or p.designation = any (array['Super Admin','Admin','General Manager','Manager','HR','DMS','Accountant']::text[])
      )
      and (
        p.is_super_admin = true
        or p.designation in ('Admin','General Manager')
        or v_vehicle.department = any(coalesce(p.department_access, array[p.department]::text[]))
      )
  ) then raise exception 'You do not have permission to move this vehicle out of stock.'; end if;

  v_stage := upper(p_exit_type);
  v_status := case upper(p_exit_type)
    when 'RETAIL' then 'Delivered'
    when 'DEMO' then 'Moved to Demo'
    when 'DAMAGE' then 'Moved to Damage'
    when 'TRANSFER_OUT' then 'Transferred Out'
    else 'Moved Out - Other'
  end;

  update public.vehicles
  set stage = v_stage,
      status = v_status,
      customer_name = coalesce(nullif(trim(p_customer_name),''), customer_name),
      retail_date = case when upper(p_exit_type) = 'RETAIL' then p_exit_date else retail_date end,
      retailed_by = case when upper(p_exit_type) = 'RETAIL' then auth.uid() else retailed_by end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_vehicle_id;

  insert into public.vehicle_exit_records (
    vehicle_id, department, exit_type, exit_date, reason, destination,
    customer_name, sc_name, created_by, vehicle_snapshot
  ) values (
    v_vehicle.id, v_vehicle.department, upper(p_exit_type), p_exit_date,
    nullif(trim(coalesce(p_reason,'')),''), nullif(trim(coalesce(p_destination,'')),''),
    coalesce(nullif(trim(p_customer_name),''), v_vehicle.customer_name),
    v_vehicle.sc_name, auth.uid(),
    to_jsonb(v_vehicle) || jsonb_build_object(
      'exit_type', upper(p_exit_type), 'exit_date', p_exit_date,
      'reason', nullif(trim(coalesce(p_reason,'')),''),
      'destination', nullif(trim(coalesce(p_destination,'')),''),
      'notes', nullif(trim(coalesce(p_notes,'')),'')
    )
  ) returning * into v_record;
  return v_record;
end;
$$;

revoke all on function public.register_vehicle_exit(uuid,text,date,text,text,text,text) from public, anon;
grant execute on function public.register_vehicle_exit(uuid,text,date,text,text,text,text) to authenticated;

insert into public.vehicle_exit_records (
  vehicle_id, department, exit_type, exit_date, customer_name, sc_name,
  created_by, vehicle_snapshot
)
select v.id, v.department, 'RETAIL', v.retail_date,
       v.customer_name, v.sc_name, coalesce(v.retailed_by, v.updated_by, v.created_by),
       to_jsonb(v) || jsonb_build_object('exit_type','RETAIL','exit_date',v.retail_date)
from public.vehicles v
where v.stage = 'RETAIL'
  and v.retail_date is not null
  and coalesce(v.retailed_by, v.updated_by, v.created_by) is not null
  and not exists (
    select 1 from public.vehicle_exit_records e
    where e.vehicle_id = v.id and e.exit_type = 'RETAIL'
  );
