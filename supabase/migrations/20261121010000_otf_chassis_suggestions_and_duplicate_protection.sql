-- OTF chassis suggestions, external chassis entry and race-safe duplicate protection.
alter table public.otf_order_books alter column vehicle_id drop not null;
alter table public.otf_order_books add column if not exists is_external_vehicle boolean not null default false;

alter table public.otf_order_books drop constraint if exists otf_order_books_status_check;
alter table public.otf_order_books add constraint otf_order_books_status_check
  check (status in ('BOOKED','IN PROCESS','DELIVERED','CANCELLED'));

drop index if exists public.otf_one_active_booking_per_vehicle_idx;
create unique index if not exists otf_one_active_booking_per_vehicle_idx
  on public.otf_order_books(vehicle_id)
  where vehicle_id is not null and status in ('BOOKED','IN PROCESS','DELIVERED');

create unique index if not exists otf_one_active_booking_per_chassis_idx
  on public.otf_order_books(upper(regexp_replace(trim(chassis_number), '\s+', '', 'g')))
  where status in ('BOOKED','IN PROCESS','DELIVERED');

create or replace function public.validate_otf_order_book_vehicle()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.vehicles%rowtype;
begin
  new.chassis_number := upper(regexp_replace(trim(coalesce(new.chassis_number,'')), '\s+', '', 'g'));
  if new.chassis_number = '' then
    raise exception 'Chassis number is required.' using errcode='23514';
  end if;
  if new.vehicle_id is not null then
    select * into v from public.vehicles where id=new.vehicle_id;
    if not found then raise exception 'Selected stock vehicle no longer exists.' using errcode='23503'; end if;
    if v.department <> new.department
       or upper(regexp_replace(trim(v.chassis_number), '\s+', '', 'g')) <> new.chassis_number then
      raise exception 'Chassis number does not match the selected department stock vehicle.' using errcode='23514';
    end if;
    if upper(regexp_replace(trim(coalesce(v.model,'')), '[^A-Z0-9]', '', 'g')) <> upper(regexp_replace(trim(coalesce(new.model,'')), '[^A-Z0-9]', '', 'g'))
       or upper(regexp_replace(trim(coalesce(v.variant,'')), '[^A-Z0-9]', '', 'g')) <> upper(regexp_replace(trim(coalesce(new.variant,'')), '[^A-Z0-9]', '', 'g')) then
      raise exception 'Selected stock vehicle model/variant does not match the OTF booking.' using errcode='23514';
    end if;
    new.is_external_vehicle := false;
  else
    if not new.is_external_vehicle then
      raise exception 'Choose a stock chassis or explicitly mark this as an external vehicle.' using errcode='23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_validate_otf_order_book_vehicle on public.otf_order_books;
create trigger trg_validate_otf_order_book_vehicle
before insert or update of department,vehicle_id,chassis_number,model,variant,is_external_vehicle
on public.otf_order_books for each row
execute function public.validate_otf_order_book_vehicle();
