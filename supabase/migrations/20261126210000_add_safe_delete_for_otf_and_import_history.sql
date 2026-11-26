-- Safe, audited deletion for Excel Upload History and cancelled OTF records only.
drop policy if exists department_delete_stock_import_batches on public.stock_import_batches;
drop policy if exists stock_import_batches_manager_delete on public.stock_import_batches;
create policy stock_import_batches_manager_delete on public.stock_import_batches for delete to authenticated
using (
 private.can_access_department(department)
 and private.has_permission('common_excel_upload'::public.app_module,'view'::public.app_action)
 and (private.is_super_admin() or exists (
  select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.status='active' and p.deleted_at is null
  and lower(trim(coalesce(p.designation,''))) in ('admin','general manager','manager')
 ))
);
drop policy if exists otf_order_books_manager_delete on public.otf_order_books;
create policy otf_order_books_manager_delete on public.otf_order_books for delete to authenticated
using (
 status='CANCELLED'
 and private.can_view_otf_record(department,created_by,coalesce(nullif(btrim(unit_city),''),city))
 and private.has_permission('otf_management'::public.app_module,'view'::public.app_action)
 and (private.is_super_admin() or exists (
  select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.status='active' and p.deleted_at is null
  and lower(trim(coalesce(p.designation,''))) in ('admin','general manager','manager')
 ))
);
create or replace function public.delete_stock_import_batch(p_batch_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare v_batch public.stock_import_batches%rowtype; v_profile public.profiles%rowtype; v_is_super_admin boolean;
begin
 if (select auth.uid()) is null then raise exception using errcode='42501',message='Sign in is required.'; end if;
 select p.* into v_profile from public.profiles p where p.user_id=(select auth.uid()) and p.status='active' and p.deleted_at is null;
 if not found then raise exception using errcode='42501',message='An active employee profile is required.'; end if;
 v_is_super_admin:=coalesce(v_profile.is_super_admin,false) or lower(trim(coalesce(v_profile.designation,'')))='super admin' or private.is_super_admin();
 if not v_is_super_admin and lower(trim(coalesce(v_profile.designation,''))) not in ('admin','general manager','manager') then raise exception using errcode='42501',message='Only Super Admin, Admin, General Manager or Manager can delete upload history.'; end if;
 if not private.has_permission('common_excel_upload'::public.app_module,'view'::public.app_action) then raise exception using errcode='42501',message='Excel Upload History permission is required.'; end if;
 select b.* into v_batch from public.stock_import_batches b where b.id=p_batch_id for update;
 if not found then raise exception using errcode='P0002',message='Upload history record was not found or is not visible to your account.'; end if;
 if not private.can_access_department(v_batch.department) then raise exception using errcode='42501',message='You cannot delete history from this department.'; end if;
 if not v_is_super_admin then
  insert into public.audit_logs(actor_id,actor_email,actor_designation,module,action,action_label,record_type,record_id,details)
  values((select auth.uid()),v_profile.email,v_profile.designation,'common_excel_upload'::public.app_module,'delete'::public.app_action,'Deleted Excel upload history','stock_import_batch',v_batch.id::text,
   jsonb_build_object('file_name',v_batch.file_name,'department',v_batch.department,'imported_rows',v_batch.imported_rows,'skipped_rows',v_batch.skipped_rows,'error_rows',v_batch.error_rows));
 end if;
 delete from public.stock_import_batches where id=v_batch.id;
 if not found then raise exception using errcode='42501',message='Upload history could not be deleted.'; end if;
 return jsonb_build_object('id',v_batch.id,'department',v_batch.department);
end;
$function$;
create or replace function public.delete_otf_order_book(p_otf_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare v_otf public.otf_order_books%rowtype; v_profile public.profiles%rowtype; v_is_super_admin boolean;
begin
 if (select auth.uid()) is null then raise exception using errcode='42501',message='Sign in is required.'; end if;
 select p.* into v_profile from public.profiles p where p.user_id=(select auth.uid()) and p.status='active' and p.deleted_at is null;
 if not found then raise exception using errcode='42501',message='An active employee profile is required.'; end if;
 v_is_super_admin:=coalesce(v_profile.is_super_admin,false) or lower(trim(coalesce(v_profile.designation,'')))='super admin' or private.is_super_admin();
 if not v_is_super_admin and lower(trim(coalesce(v_profile.designation,''))) not in ('admin','general manager','manager') then raise exception using errcode='42501',message='Only Super Admin, Admin, General Manager or Manager can delete OTF records.'; end if;
 if not private.has_permission('otf_management'::public.app_module,'view'::public.app_action) then raise exception using errcode='42501',message='OTF Management permission is required.'; end if;
 select o.* into v_otf from public.otf_order_books o where o.id=p_otf_id for update;
 if not found then raise exception using errcode='P0002',message='OTF record was not found or is not visible to your account.'; end if;
 if v_otf.status<>'CANCELLED' then raise exception using errcode='42501',message='Only CANCELLED OTF records can be deleted. Change the status to CANCELLED first.'; end if;
 if not private.can_view_otf_record(v_otf.department,v_otf.created_by,coalesce(nullif(btrim(v_otf.unit_city),''),v_otf.city)) then raise exception using errcode='42501',message='You cannot delete this OTF record because it is outside your department or city access.'; end if;
 if not v_is_super_admin then
  insert into public.audit_logs(actor_id,actor_email,actor_designation,module,action,action_label,record_type,record_id,details)
  values((select auth.uid()),v_profile.email,v_profile.designation,'otf_management'::public.app_module,'delete'::public.app_action,'Deleted cancelled OTF order book','otf_order_book',v_otf.id::text,
   jsonb_build_object('order_number',v_otf.order_number,'department',v_otf.department,'status',v_otf.status));
 end if;
 delete from public.otf_order_books where id=v_otf.id;
 if not found then raise exception using errcode='42501',message='OTF record could not be deleted.'; end if;
 return jsonb_build_object('id',v_otf.id,'order_number',v_otf.order_number,'department',v_otf.department);
end;
$function$;
revoke all on function public.delete_stock_import_batch(uuid) from public;
revoke all on function public.delete_otf_order_book(uuid) from public;
grant execute on function public.delete_stock_import_batch(uuid) to authenticated;
grant execute on function public.delete_otf_order_book(uuid) to authenticated;
