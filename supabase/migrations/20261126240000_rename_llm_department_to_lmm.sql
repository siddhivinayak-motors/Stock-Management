-- Rename the department's canonical value from LLM to LMM without changing internal route keys.
do $$
declare
  r record;
begin
  for r in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'department'
      and data_type = 'text'
  loop
    execute format(
      'update %I.%I set department = %L where upper(department) = %L',
      r.table_schema, r.table_name, 'LMM', 'LLM'
    );
  end loop;
end;
$$;

-- Keep employee department assignments aligned with the new canonical name.
update public.profiles
set department = case when upper(coalesce(department,'')) = 'LLM' then 'LMM' else department end,
    department_access = array_replace(department_access, 'LLM', 'LMM')
where upper(coalesce(department,'')) = 'LLM'
   or 'LLM' = any(coalesce(department_access, '{}'::text[]));

-- Replace the Tally reconciliation function so the persisted department is LMM.
CREATE OR REPLACE FUNCTION public.reconcile_tally_stock(p_department text, p_rows jsonb, p_file_name text, p_expected_total integer, p_model_totals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_department text := upper(trim(coalesce(p_department, '')));
  v_row_count integer;
  v_inserted integer := 0;
  v_retailed integer := 0;
  v_unchanged integer := 0;
  v_protected integer := 0;
  v_vehicle public.vehicles%rowtype;
  v_department_name text;
  v_new_count integer := 0;
begin
  v_department_name := case when v_department = 'LMM' then 'LMM' else 'Commercial' end;
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_department not in ('COMMERCIAL', 'LMM') then
    raise exception 'This reconciliation is restricted to Commercial and LMM.';
  end if;
  if not private.has_permission('common_excel_upload'::public.app_module, 'create'::public.app_action)
     or not private.can_access_department(v_department_name) then
    raise exception 'Common Excel Upload permission and matching department access are required.';
  end if;
  if not private.has_permission('stock_register'::public.app_module, 'view'::public.app_action) then
    raise exception 'Stock Register view permission is required to reconcile daily stock.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_typeof(p_model_totals) <> 'array' then
    raise exception 'Invalid Tally data. Preview the workbook again.';
  end if;
  select count(*) into v_row_count from jsonb_array_elements(p_rows);
  if v_row_count = 0 or v_row_count <> p_expected_total then
    raise exception 'Tally total does not match the validated chassis row count.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as x(chassis_number text, model text, colour text)
    where coalesce(trim(x.chassis_number), '') !~ '^[A-Z0-9]{17}$'
       or coalesce(trim(x.model), '') = ''
       or coalesce(trim(x.colour), '') = ''
  ) then raise exception 'A chassis, model or colour value is missing or invalid.'; end if;
  if exists (
    select upper(trim(chassis_number)) from jsonb_to_recordset(p_rows) as x(chassis_number text)
    group by upper(trim(chassis_number)) having count(*) > 1
  ) then raise exception 'Duplicate chassis numbers exist in the uploaded Tally file.'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_model_totals) as m(model text, quantity integer)
    where coalesce(trim(m.model), '') = '' or coalesce(m.quantity, 0) < 1
       or m.quantity <> (select count(*) from jsonb_to_recordset(p_rows) as x(model text) where trim(x.model) = trim(m.model))
  ) then raise exception 'A model-wise quantity does not match its chassis rows.'; end if;
  if (select count(distinct trim(model)) from jsonb_to_recordset(p_rows) as x(model text)) <> jsonb_array_length(p_model_totals) then
    raise exception 'Model summary does not match the uploaded chassis rows.';
  end if;
  if exists (
    select 1 from public.vehicles v
    join jsonb_to_recordset(p_rows) as x(chassis_number text) on upper(trim(v.chassis_number)) = upper(trim(x.chassis_number))
    where upper(v.department) = v_department and v.stage = 'RETAIL'
  ) then raise exception 'The Tally file contains a chassis already marked Retail. Resolve it before importing.'; end if;
  select count(*) into v_unchanged
  from public.vehicles v join jsonb_to_recordset(p_rows) as x(chassis_number text)
    on upper(trim(v.chassis_number)) = upper(trim(x.chassis_number))
  where upper(v.department) = v_department;
  -- Count expected additions before insert. A global chassis conflict (including another department) must abort, not silently skip.
  select count(*) into v_new_count
  from jsonb_to_recordset(p_rows) as x(chassis_number text)
  where not exists (
    select 1 from public.vehicles v
    where upper(trim(v.chassis_number)) = upper(trim(x.chassis_number))
      and upper(v.department) = v_department
  );

  insert into public.vehicles (department, chassis_number, model, colour, status, stage, source, imported_at, created_by)
  select v_department_name, upper(trim(x.chassis_number)), trim(x.model), trim(x.colour),
         'Received / In Stock', 'OPEN', 'tally_daily_stock_sync', now(), auth.uid()
  from jsonb_to_recordset(p_rows) as x(chassis_number text, model text, colour text)
  where not exists (select 1 from public.vehicles v where upper(trim(v.chassis_number)) = upper(trim(x.chassis_number)))
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted <> v_new_count then
    raise exception 'One or more chassis numbers conflict with existing stock or were concurrently imported. No changes were committed; refresh and preview again.';
  end if;
  for v_vehicle in
    select v.* from public.vehicles v
    where upper(v.department) = v_department
      and upper(v.stage) in ('OPEN', 'ALLOTED', 'ALLOTTED', 'DEALER', 'HOLD')
      and not exists (select 1 from jsonb_to_recordset(p_rows) as x(chassis_number text)
        where upper(trim(x.chassis_number)) = upper(trim(v.chassis_number)))
    for update
  loop
    update public.vehicles set stage='RETAIL', status='Delivered', retail_date=current_date,
      retailed_by=auth.uid(), updated_by=auth.uid(), updated_at=now() where id=v_vehicle.id;
    insert into public.vehicle_exit_records (
      vehicle_id, department, exit_type, exit_date, reason, customer_name, sc_name, created_by, vehicle_snapshot, approval_status
    ) values (
      v_vehicle.id, v_vehicle.department, 'RETAIL', current_date,
      'Not present in validated complete Tally closing stock report',
      v_vehicle.customer_name, v_vehicle.sc_name, auth.uid(),
      to_jsonb(v_vehicle) || jsonb_build_object('exit_type','RETAIL','exit_date',current_date,
        'reason','Not present in validated complete Tally closing stock report','source_file',p_file_name),
      'APPROVED'
    );
    v_retailed := v_retailed + 1;
  end loop;
  select count(*) into v_protected from public.vehicles v
  where upper(v.department)=v_department
    and upper(v.stage) not in ('OPEN','ALLOTED','ALLOTTED','DEALER','HOLD','RETAIL')
    and not exists (select 1 from jsonb_to_recordset(p_rows) as x(chassis_number text)
      where upper(trim(x.chassis_number))=upper(trim(v.chassis_number)));
  insert into public.stock_import_batches(file_name,department,imported_rows,skipped_rows,error_rows,created_by)
  values(coalesce(nullif(trim(p_file_name),''),'Tally Closing Stock'),v_department_name,v_inserted,v_unchanged+v_protected,0,auth.uid());
  return jsonb_build_object('department',v_department_name,'total_rows',v_row_count,
    'inserted',v_inserted,'unchanged',v_unchanged,'retailed',v_retailed,'protected_not_moved',v_protected);
end;
$function$

