create or replace function public.svm_operational_reset(p_selection jsonb, p_execute boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid := '236565a9-1892-41ee-b54a-c81bde3b9b01';
  v_key text;
  v_allowed text[] := array[
    'personal.stock','personal.holds','personal.quotations','personal.price_list','personal.excel_upload',
    'ev.stock','ev.holds','ev.quotations','ev.price_list','ev.excel_upload',
    'commercial.stock','commercial.holds','commercial.quotations','commercial.price_list','commercial.excel_upload',
    'llm.stock','llm.holds','llm.quotations','llm.price_list','llm.excel_upload',
    'workspace.price_list_imports','workspace.common_excel_upload','workspace.audit_history','workspace.retail_reports'
  ];
  v_dept text;
  v_counts jsonb := '{}'::jsonb;
  v_total bigint := 0;
  v_n bigint;
  v_email text;
  v_designation text;
begin
  if v_uid is null or v_uid <> v_owner or not exists (
    select 1 from public.profiles p
    where p.user_id = v_owner and p.is_super_admin is true and lower(coalesce(p.status,'')) = 'active'
  ) then
    raise exception 'Operational reset is restricted to the designated active Super Admin account.';
  end if;
  if jsonb_typeof(p_selection) <> 'array' or jsonb_array_length(p_selection) = 0 then
    raise exception 'Select at least one reset option.';
  end if;
  for v_key in select distinct jsonb_array_elements_text(p_selection) loop
    if not (v_key = any(v_allowed)) then raise exception 'Invalid reset option: %', v_key; end if;
  end loop;
  select email, designation into v_email, v_designation from public.profiles where user_id = v_owner;

  for v_key in select distinct jsonb_array_elements_text(p_selection) loop
    v_dept := case split_part(v_key,'.',1)
      when 'personal' then 'Personal' when 'ev' then 'EV'
      when 'commercial' then 'Commercial' when 'llm' then 'LLM' else null end;
    v_n := 0;
    case
      when split_part(v_key,'.',2) = 'stock' and v_dept is not null then
        select (select count(*) from public.vehicles where department=v_dept)
             + (select count(*) from public.vehicle_exit_records where department=v_dept) into v_n;
        if p_execute then
          delete from public.vehicle_exit_records where department=v_dept;
          delete from public.vehicles where department=v_dept;
        end if;
      when split_part(v_key,'.',2) = 'holds' and v_dept is not null then
        select count(*) into v_n from public.stock_holds where department=v_dept;
        if p_execute then delete from public.stock_holds where department=v_dept; end if;
      when split_part(v_key,'.',2) = 'quotations' and v_dept is not null then
        select count(*) into v_n from public.quotations where department=v_dept;
        if p_execute then delete from public.quotations where department=v_dept; end if;
      when split_part(v_key,'.',2) = 'price_list' and v_dept is not null then
        select count(*) into v_n from public.price_list_versions where department=v_dept;
        if p_execute then
          delete from public.price_list_import_batches where department=v_dept;
          delete from public.price_list_versions where department=v_dept;
        end if;
      when split_part(v_key,'.',2) = 'excel_upload' and v_dept is not null then
        select (select count(*) from public.stock_import_batches where department=v_dept)
             + (select count(*) from public.vehicles where department=v_dept and source='standard_stock_report')
             + (select count(*) from public.vehicle_exit_records e join public.vehicles v on v.id=e.vehicle_id where v.department=v_dept and v.source='standard_stock_report')
          into v_n;
        if p_execute then
          delete from public.vehicle_exit_records e using public.vehicles v
          where e.vehicle_id=v.id and v.department=v_dept and v.source='standard_stock_report';
          delete from public.vehicles where department=v_dept and source='standard_stock_report';
          delete from public.stock_import_batches where department=v_dept;
        end if;
      when v_key = 'workspace.price_list_imports' then
        select count(*) into v_n from public.price_list_import_batches;
        if p_execute then delete from public.price_list_import_batches; end if;
      when v_key = 'workspace.common_excel_upload' then
        select (select count(*) from public.stock_import_batches)
             + (select count(*) from public.vehicles where source='standard_stock_report')
             + (select count(*) from public.vehicle_exit_records e join public.vehicles v on v.id=e.vehicle_id where v.source='standard_stock_report')
          into v_n;
        if p_execute then
          delete from public.vehicle_exit_records e using public.vehicles v
          where e.vehicle_id=v.id and v.source='standard_stock_report';
          delete from public.vehicles where source='standard_stock_report';
          delete from public.stock_import_batches;
        end if;
      when v_key = 'workspace.audit_history' then
        select count(*) into v_n from public.audit_logs;
        if p_execute then delete from public.audit_logs; end if;
      when v_key = 'workspace.retail_reports' then
        select count(*) into v_n from public.vehicle_exit_records;
        if p_execute then delete from public.vehicle_exit_records; end if;
      else
        raise exception 'Unsupported reset option: %', v_key;
    end case;
    v_counts := v_counts || jsonb_build_object(v_key,v_n);
    v_total := v_total + v_n;
  end loop;

  if p_execute then
    insert into public.audit_logs(actor_id,actor_email,actor_designation,module,action,action_label,record_type,details)
    values(v_uid,v_email,v_designation,'backup_restore'::app_module,'delete'::app_action,
      'Operational reset executed','operational_reset',
      jsonb_build_object('selection',p_selection,'deleted_record_count',v_total,'employee_management_excluded',true,'restricted_owner_uid',v_owner));
  end if;
  return jsonb_build_object('executed',p_execute,'counts',v_counts,'total_rows',v_total,'employee_management_excluded',true,'authorized_owner_uid',v_owner);
end;
$function$;
