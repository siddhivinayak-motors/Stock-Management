-- Pending Exit stock reconciliation and Retail Register classification.
-- Applied to Supabase project tvpaxdvqvwpblcfssgsj as migration 20261122191041.

alter table public.vehicle_exit_records
  drop constraint if exists vehicle_exit_records_exit_type_check;
alter table public.vehicle_exit_records
  add constraint vehicle_exit_records_exit_type_check
  check (exit_type = any (array['PENDING_EXIT','RETAIL','DEMO','DAMAGE','TRANSFER_OUT','OTHER']::text[]));

create unique index if not exists vehicle_exit_records_one_pending_per_vehicle_uidx
  on public.vehicle_exit_records(vehicle_id)
  where exit_type='PENDING_EXIT' and vehicle_id is not null;

create or replace function public.sync_pratik_personal_ev_stock(
  p_rows jsonb,
  p_file_name text default 'Pratik Bhadeka Stock.xlsx'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_old integer := 0;
  v_uploaded integer := 0;
  v_personal integer := 0;
  v_ev integer := 0;
  v_removed integer := 0;
  v_updated integer := 0;
  v_inserted integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.is_super_admin()
     and not private.has_permission('common_excel_upload'::public.app_module,'create'::public.app_action) then
    raise exception 'Common Excel Upload permission required';
  end if;
  if not private.is_super_admin()
     and (not private.can_access_department('Personal') or not private.can_access_department('EV')) then
    raise exception 'Access to both Personal and EV departments is required';
  end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then
    raise exception 'The STOCK worksheet has no valid vehicle rows';
  end if;
  if exists(
    select 1 from jsonb_to_recordset(p_rows) as x(department text,chassis_number text,model text,stage text)
    where x.department not in ('Personal','EV')
      or nullif(btrim(x.chassis_number),'') is null
      or nullif(btrim(x.model),'') is null
      or coalesce(nullif(upper(btrim(x.stage)),''),'OPEN') not in
        ('OPEN','HOLD','ALLOTED','DAMAGE','RETAIL','DEMO','TRANSFER_OUT','OTHER','BILLING DONE','DEALER','DAMO')
  ) then
    raise exception 'Invalid department, model, chassis number or stage in STOCK worksheet';
  end if;
  if exists(
    select upper(btrim(chassis_number))
    from jsonb_to_recordset(p_rows) as x(chassis_number text)
    group by upper(btrim(chassis_number)) having count(*)>1
  ) then
    raise exception 'Duplicate chassis numbers found in uploaded STOCK worksheet';
  end if;
  if exists(
    select 1 from public.vehicles v
    join jsonb_to_recordset(p_rows) as x(chassis_number text)
      on upper(btrim(v.chassis_number))=upper(btrim(x.chassis_number))
    where v.department not in ('Personal','EV')
  ) then
    raise exception 'An uploaded chassis number already belongs to Commercial or LLM. No data was changed.';
  end if;

  select count(*) into v_old
  from public.vehicles where department in ('Personal','EV');

  select count(*) into v_removed
  from public.vehicles v
  where v.department in ('Personal','EV')
    and v.stage not in ('RETAIL','DEMO','DAMAGE','TRANSFER_OUT','OTHER','PENDING_EXIT')
    and not exists(
      select 1 from jsonb_to_recordset(p_rows) as x(chassis_number text)
      where upper(btrim(x.chassis_number))=upper(btrim(v.chassis_number))
    );

  insert into private.pratik_stock_sync_archive(record_type,original_id,department,chassis_number,payload,archived_at)
  select 'vehicle',v.id,v.department,v.chassis_number,to_jsonb(v),now()
  from public.vehicles v where v.department in ('Personal','EV')
  on conflict(record_type,original_id) do update set
    department=excluded.department,
    chassis_number=excluded.chassis_number,
    payload=excluded.payload,
    archived_at=excluded.archived_at;

  delete from public.vehicle_exit_records e
  using public.vehicles v, jsonb_to_recordset(p_rows) as x(chassis_number text)
  where e.vehicle_id=v.id
    and e.exit_type='PENDING_EXIT'
    and upper(btrim(v.chassis_number))=upper(btrim(x.chassis_number))
    and v.department in ('Personal','EV');

  with incoming as (
    select * from jsonb_to_recordset(p_rows) as x(
      department text,sr_no integer,model text,variant text,seating text,colour text,
      mfg_year_label text,manufacturing_year integer,oem_invoice_date date,chassis_number text,
      engine_number text,status text,place text,ageing numeric,stage text,sc_name text,
      customer_name text,alloted_date date,alloted_ageing numeric,source_row integer
    )
  )
  update public.vehicles v
  set department=i.department,
      sr_no=i.sr_no,
      model=btrim(i.model),
      variant=nullif(btrim(i.variant),''),
      seating=nullif(btrim(i.seating),''),
      colour=nullif(btrim(i.colour),''),
      mfg_year_label=nullif(btrim(i.mfg_year_label),''),
      manufacturing_year=i.manufacturing_year,
      oem_invoice_date=i.oem_invoice_date,
      chassis_number=upper(btrim(i.chassis_number)),
      engine_number=nullif(btrim(i.engine_number),''),
      status=coalesce(nullif(btrim(i.status),''),'Received / In Stock'),
      place=nullif(btrim(i.place),''),
      ageing=i.ageing,
      stage=coalesce(nullif(upper(btrim(i.stage)),''),'OPEN'),
      sc_name=nullif(btrim(i.sc_name),''),
      customer_name=nullif(btrim(i.customer_name),''),
      alloted_date=i.alloted_date,
      alloted_ageing=i.alloted_ageing,
      source_row=i.source_row,
      source='pratik_bhadeka_stock_sheet',
      imported_at=now(),
      updated_by=v_uid,
      updated_at=now()
  from incoming i
  where upper(btrim(v.chassis_number))=upper(btrim(i.chassis_number))
    and v.department in ('Personal','EV');
  get diagnostics v_updated = row_count;

  with incoming as (
    select * from jsonb_to_recordset(p_rows) as x(
      department text,sr_no integer,model text,variant text,seating text,colour text,
      mfg_year_label text,manufacturing_year integer,oem_invoice_date date,chassis_number text,
      engine_number text,status text,place text,ageing numeric,stage text,sc_name text,
      customer_name text,alloted_date date,alloted_ageing numeric,source_row integer
    )
  ), inserted as (
    insert into public.vehicles(
      department,sr_no,model,variant,seating,colour,mfg_year_label,
      manufacturing_year,oem_invoice_date,chassis_number,engine_number,status,place,ageing,stage,
      sc_name,customer_name,alloted_date,alloted_ageing,source_row,source,imported_at,created_by
    )
    select i.department,i.sr_no,btrim(i.model),nullif(btrim(i.variant),''),nullif(btrim(i.seating),''),
      nullif(btrim(i.colour),''),nullif(btrim(i.mfg_year_label),''),i.manufacturing_year,i.oem_invoice_date,
      upper(btrim(i.chassis_number)),nullif(btrim(i.engine_number),''),
      coalesce(nullif(btrim(i.status),''),'Received / In Stock'),nullif(btrim(i.place),''),
      i.ageing,coalesce(nullif(upper(btrim(i.stage)),''),'OPEN'),nullif(btrim(i.sc_name),''),
      nullif(btrim(i.customer_name),''),i.alloted_date,i.alloted_ageing,i.source_row,
      'pratik_bhadeka_stock_sheet',now(),v_uid
    from incoming i
    where not exists(
      select 1 from public.vehicles v
      where upper(btrim(v.chassis_number))=upper(btrim(i.chassis_number))
    )
    returning department
  )
  select count(*),count(*) filter(where department='Personal'),count(*) filter(where department='EV')
  into v_inserted,v_personal,v_ev from inserted;

  update public.vehicles v
  set stage='PENDING_EXIT',
      status='Pending Exit',
      updated_by=v_uid,
      updated_at=now()
  where v.department in ('Personal','EV')
    and v.stage not in ('RETAIL','DEMO','DAMAGE','TRANSFER_OUT','OTHER','PENDING_EXIT')
    and not exists(
      select 1 from jsonb_to_recordset(p_rows) as x(chassis_number text)
      where upper(btrim(x.chassis_number))=upper(btrim(v.chassis_number))
    );

  insert into public.vehicle_exit_records(
    vehicle_id,department,exit_type,exit_date,reason,destination,customer_name,sc_name,created_by,vehicle_snapshot
  )
  select v.id,v.department,'PENDING_EXIT',current_date,
    'Not present in latest Pratik Personal / EV STOCK upload',
    null,v.customer_name,v.sc_name,v_uid,
    to_jsonb(v)||jsonb_build_object('exit_type','PENDING_EXIT','exit_date',current_date,'pending_since',now())
  from public.vehicles v
  where v.department in ('Personal','EV')
    and v.stage='PENDING_EXIT'
    and not exists(
      select 1 from jsonb_to_recordset(p_rows) as x(chassis_number text)
      where upper(btrim(x.chassis_number))=upper(btrim(v.chassis_number))
    )
    and not exists(
      select 1 from public.vehicle_exit_records e
      where e.vehicle_id=v.id and e.exit_type='PENDING_EXIT'
    );

  v_uploaded := v_updated + v_inserted;

  insert into public.stock_import_batches(file_name,department,imported_rows,skipped_rows,error_rows,created_by)
  values(coalesce(p_file_name,'Pratik Bhadeka Stock.xlsx'),'Personal + EV',v_uploaded,0,0,v_uid);

  insert into public.audit_logs(actor_id,actor_email,module,action,action_label,record_type,details,actor_designation)
  select v_uid,u.email,'common_excel_upload'::public.app_module,'create'::public.app_action,
    'Pratik Bhadeka Personal/EV stock reconcile','stock_import_batch',
    jsonb_build_object('file',p_file_name,'previous_rows',v_old,'uploaded_rows',v_uploaded,
      'new_rows',v_inserted,'updated_rows',v_updated,'personal_rows',v_personal,'ev_rows',v_ev,
      'pending_exit_rows',v_removed),p.designation
  from auth.users u left join public.profiles p on p.user_id=v_uid where u.id=v_uid;

  return jsonb_build_object('previous_rows',v_old,'uploaded_rows',v_uploaded,
    'new_rows',v_inserted,'updated_rows',v_updated,'personal_rows',v_personal,'ev_rows',v_ev,
    'removed_rows',v_removed,'pending_exit_rows',v_removed);
end;
$function$;

create or replace function public.classify_vehicle_exit(
  p_exit_record_id uuid,
  p_exit_type text,
  p_exit_date date default current_date,
  p_reason text default null,
  p_destination text default null,
  p_customer_name text default null,
  p_notes text default null
)
returns public.vehicle_exit_records
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_exit public.vehicle_exit_records%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_type text := upper(coalesce(p_exit_type,''));
  v_status text;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  if v_type not in ('RETAIL','DEMO','DAMAGE','TRANSFER_OUT','OTHER') then
    raise exception 'Choose a valid exit classification.';
  end if;
  if p_exit_date is null then raise exception 'Exit date is required.'; end if;
  if v_type <> 'RETAIL' and coalesce(trim(p_reason),'') = '' then
    raise exception 'Please enter the reason for this stock exit.';
  end if;

  select * into v_exit
  from public.vehicle_exit_records
  where id=p_exit_record_id
  for update;
  if not found then raise exception 'Exit record not found.'; end if;

  select * into v_vehicle
  from public.vehicles
  where id=v_exit.vehicle_id
  for update;
  if not found then raise exception 'Linked vehicle record not found.'; end if;

  if not exists(
    select 1 from public.profiles p
    where p.user_id=v_uid and p.status='active'
      and (p.is_super_admin=true or p.designation=any(array[
        'Super Admin','Admin','General Manager','Manager','HR','DMS','Accountant'
      ]::text[]))
      and (p.is_super_admin=true or p.designation in ('Admin','General Manager')
        or v_vehicle.department=any(coalesce(p.department_access,array[p.department]::text[]))
  ) then raise exception 'You do not have permission to edit this Retail Register record.'; end if;

  v_status := case v_type
    when 'RETAIL' then 'Delivered'
    when 'DEMO' then 'Moved to Demo'
    when 'DAMAGE' then 'Moved to Damage'
    when 'TRANSFER_OUT' then 'Transferred Out'
    else 'Moved Out - Other'
  end;

  update public.vehicles
  set stage=v_type,
      status=v_status,
      customer_name=coalesce(nullif(trim(p_customer_name),''),customer_name),
      retail_date=case when v_type='RETAIL' then p_exit_date else null end,
      retailed_by=case when v_type='RETAIL' then v_uid else null end,
      updated_by=v_uid,
      updated_at=now()
  where id=v_vehicle.id;

  update public.vehicle_exit_records
  set exit_type=v_type,
      exit_date=p_exit_date,
      reason=nullif(trim(coalesce(p_reason,'')),''),
      destination=nullif(trim(coalesce(p_destination,'')),''),
      customer_name=coalesce(nullif(trim(p_customer_name),''),v_vehicle.customer_name),
      sc_name=v_vehicle.sc_name,
      vehicle_snapshot=coalesce(vehicle_snapshot,'{}'::jsonb)||to_jsonb(v_vehicle)
        ||jsonb_build_object('exit_type',v_type,'exit_date',p_exit_date,
          'reason',nullif(trim(coalesce(p_reason,'')),''),
          'destination',nullif(trim(coalesce(p_destination,'')),''),
          'notes',nullif(trim(coalesce(p_notes),''))),
      vehicle_id=v_vehicle.id
  where id=p_exit_record_id
  returning * into v_exit;

  return v_exit;
end;
$function$;

revoke execute on function public.classify_vehicle_exit(uuid,text,date,text,text,text,text) from public, anon;
grant execute on function public.classify_vehicle_exit(uuid,text,date,text,text,text,text) to authenticated;
