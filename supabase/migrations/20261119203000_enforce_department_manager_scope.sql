-- Department Managers are limited to their primary department. Admin/GM retain
-- organization-wide scope when they hold employee-management authority.
create or replace function private.can_access_department(p_department text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_super_admin()
    or exists (
      select 1 from public.profiles p
      where p.user_id=(select auth.uid()) and p.status='active'
        and (
          (p.designation in ('Admin','General Manager')
            and private.has_permission('employee_management'::public.app_module,'manage_users'::public.app_action))
          or (p.designation='Manager'
            and lower(coalesce(p.department,''))=lower(coalesce(p_department,'')))
          or (p.designation not in ('Admin','General Manager','Manager')
            and (
              lower(coalesce(p.department,''))=lower(coalesce(p_department,''))
              or lower(coalesce(p_department,'')) = any (
                select lower(x) from unnest(coalesce(p.department_access,array[]::text[])) x
              )
            ))
        )
    );
$$;
revoke all on function private.can_access_department(text) from public;
grant execute on function private.can_access_department(text) to authenticated;

-- Common Excel Upload cannot bypass department isolation.
drop policy if exists imports_insert on public.stock_import_batches;
drop policy if exists imports_select on public.stock_import_batches;
drop policy if exists department_insert_stock_import_batches on public.stock_import_batches;
create policy department_insert_stock_import_batches
on public.stock_import_batches for insert to authenticated
with check (
  private.can_access_department(department)
  or private.has_permission('backup_restore'::public.app_module,'restore'::public.app_action)
);
create policy imports_select_backup
on public.stock_import_batches for select to authenticated
using (
  private.has_permission('backup_restore'::public.app_module,'export'::public.app_action)
  or private.has_permission('backup_restore'::public.app_module,'restore'::public.app_action)
);

-- Enforce department access server-side for every row in an Excel upload.
create or replace function public.import_stock_vehicles(
  p_rows jsonb,
  p_file_name text default 'Stock Report'::text
)
returns integer language plpgsql security definer
set search_path to 'public','private','pg_temp'
as $function$
declare v_inserted integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.has_permission('common_excel_upload'::public.app_module,'create'::public.app_action)
     and not private.is_super_admin() then raise exception 'You do not have Excel Upload create permission'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Import rows must be a JSON array'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as x(department text)
    where x.department is null or not private.can_access_department(x.department)
  ) then
    raise exception 'Excel upload is restricted to your assigned department. Remove rows from other departments and upload again.';
  end if;
  with incoming as (
    select * from jsonb_to_recordset(p_rows) as x(
      department text,chassis_number text,excel_number text,model text,variant text,seating text,colour text,
      oem_invoice_date date,engine_number text,sc_name text,customer_name text,status text,stage text,place text,
      source text,imported_at timestamptz,created_by uuid)
  ), cleaned as (
    select upper(btrim(department)) department,upper(btrim(chassis_number)) chassis_number,
      nullif(upper(btrim(excel_number)),'') excel_number,coalesce(nullif(btrim(model),''),'Unknown') model,
      nullif(btrim(variant),'') variant,nullif(btrim(seating),'') seating,nullif(btrim(colour),'') colour,
      oem_invoice_date,nullif(btrim(engine_number),'') engine_number,nullif(btrim(sc_name),'') sc_name,
      nullif(btrim(customer_name),'') customer_name,coalesce(nullif(btrim(status),''),'Received') status,
      coalesce(nullif(btrim(stage),''),'OPEN') stage,nullif(btrim(place),'') place,
      coalesce(nullif(btrim(source),''),'standard_stock_report') source,imported_at,created_by
    from incoming where department is not null and upper(btrim(department)) in ('PERSONAL','EV','COMMERCIAL','LLM')
      and chassis_number is not null and btrim(chassis_number)<>'' and oem_invoice_date>=date '2025-01-01'
  ), deduped as (
    select c.*,row_number() over(partition by chassis_number order by oem_invoice_date desc nulls last) cr,
      case when excel_number is null then 1 else row_number() over(partition by excel_number order by oem_invoice_date desc nulls last) end vr
    from cleaned c
  ), inserted as (
    insert into public.vehicles(department,chassis_number,excel_number,model,variant,seating,colour,oem_invoice_date,
      engine_number,sc_name,customer_name,status,stage,place,source,imported_at,created_by)
    select case department when 'EV' then 'EV' when 'LLM' then 'LLM' when 'PERSONAL' then 'Personal' when 'COMMERCIAL' then 'Commercial' end,
      chassis_number,excel_number,model,variant,seating,colour,oem_invoice_date,engine_number,sc_name,customer_name,
      status,stage,place,source,coalesce(imported_at,now()),created_by
    from deduped where cr=1 and vr=1
    on conflict do nothing returning id
  )
  select count(*) into v_inserted from inserted;
  return v_inserted;
end;
$function$;
