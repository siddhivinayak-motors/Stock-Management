
create or replace function private.has_permission(p_module app_module, p_action app_action)
returns boolean language sql stable security definer set search_path to ''
as $function$
 select private.is_super_admin() or exists (
  select 1 from public.employee_permissions ep join public.profiles p on p.user_id=ep.user_id
  where ep.user_id=(select auth.uid()) and p.status='active' and p.deleted_at is null
   and ep.module=p_module and p_action=any(ep.actions)
   and (p_module::text<>'employee_management' or lower(trim(coalesce(p.designation,''))) in ('admin','general manager','manager','hr'))
   and (p_module::text<>'common_excel_upload' or lower(trim(coalesce(p.designation,''))) in ('admin','general manager','manager','hr'))
 );
$function$;

drop policy if exists department_select_stock_import_batches on public.stock_import_batches;
create policy department_select_stock_import_batches on public.stock_import_batches as restrictive for select to authenticated
using (private.can_access_department(department) or private.has_permission('common_excel_upload'::app_module,'view'::app_action));
drop policy if exists common_excel_upload_select_history on public.stock_import_batches;
create policy common_excel_upload_select_history on public.stock_import_batches as permissive for select to authenticated
using (private.has_permission('common_excel_upload'::app_module,'view'::app_action));
drop policy if exists department_insert_stock_import_batches on public.stock_import_batches;
create policy department_insert_stock_import_batches on public.stock_import_batches as permissive for insert to authenticated
with check (private.can_access_department(department) or private.has_permission('common_excel_upload'::app_module,'create'::app_action) or private.has_permission('backup_restore'::app_module,'restore'::app_action));

create or replace function public.import_stock_vehicles(p_rows jsonb,p_file_name text default 'Stock Report')
returns integer language plpgsql set search_path to 'public','private','pg_temp'
as $function$
declare v_inserted integer:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not private.has_permission('common_excel_upload'::public.app_module,'create'::public.app_action) and not private.is_super_admin() then
  raise exception 'You do not have Excel Upload create permission';
 end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception 'Import rows must be a JSON array'; end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as x(department text)
   where x.department is null or (not private.can_access_department(x.department) and not private.has_permission('common_excel_upload'::public.app_module,'create'::public.app_action))) then
  raise exception 'Excel upload is restricted to your assigned department. Remove rows from other departments and upload again.';
 end if;
 with incoming as (select * from jsonb_to_recordset(p_rows) as x(
  department text,chassis_number text,excel_number text,model text,variant text,seating text,colour text,
  oem_invoice_date date,engine_number text,sc_name text,customer_name text,status text,stage text,place text,
  source text,imported_at timestamptz,created_by uuid)),
 cleaned as (
  select upper(btrim(department)) department,upper(btrim(chassis_number)) chassis_number,nullif(upper(btrim(excel_number)),'') excel_number,
   coalesce(nullif(btrim(model),''),'Unknown') model,nullif(btrim(variant),'') variant,nullif(btrim(seating),'') seating,
   nullif(btrim(colour),'') colour,oem_invoice_date,nullif(btrim(engine_number),'') engine_number,
   nullif(btrim(sc_name),'') sc_name,nullif(btrim(customer_name),'') customer_name,
   coalesce(nullif(btrim(status),''),'Received') status,coalesce(nullif(btrim(stage),''),'OPEN') stage,
   nullif(btrim(place),'') place,coalesce(nullif(btrim(source),''),'standard_stock_report') source,imported_at,created_by
  from incoming where department is not null and upper(btrim(department)) in ('PERSONAL','EV','COMMERCIAL','LLM')
   and chassis_number is not null and btrim(chassis_number)<>'' and oem_invoice_date>=date '2025-01-01'
 ), deduped as (
  select c.*,row_number() over(partition by chassis_number order by oem_invoice_date desc nulls last) cr,
   case when excel_number is null then 1 else row_number() over(partition by excel_number order by oem_invoice_date desc nulls last) end vr
  from cleaned c
 ), inserted as (
  insert into public.vehicles(department,chassis_number,excel_number,model,variant,seating,colour,oem_invoice_date,engine_number,sc_name,customer_name,status,stage,place,source,imported_at,created_by)
  select case department when 'EV' then 'EV' when 'LLM' then 'LLM' when 'PERSONAL' then 'Personal' when 'COMMERCIAL' then 'Commercial' end,
   chassis_number,excel_number,model,variant,seating,colour,oem_invoice_date,engine_number,sc_name,customer_name,status,stage,place,source,coalesce(imported_at,now()),created_by
  from deduped where cr=1 and vr=1 on conflict do nothing returning id
 )
 select count(*) into v_inserted from inserted;
 return v_inserted;
end;
$function$;

insert into public.employee_permissions(user_id,module,actions,granted_by)
select p.user_id,'common_excel_upload'::app_module,
 case when lower(trim(p.designation)) in ('admin','general manager') then array['view','create','edit','delete','approve','manage_users','export','restore']::app_action[]
 else array['view','create']::app_action[] end,null
from public.profiles p where p.status='active' and p.deleted_at is null
 and lower(trim(coalesce(p.designation,''))) in ('admin','general manager','manager','hr')
on conflict(user_id,module) do update set actions=excluded.actions,updated_at=now();
delete from public.employee_permissions ep using public.profiles p
where ep.user_id=p.user_id and ep.module='common_excel_upload'::app_module
 and lower(trim(coalesce(p.designation,''))) in ('accountant','accounts','dms','executive','reception','receptionist','driver');
