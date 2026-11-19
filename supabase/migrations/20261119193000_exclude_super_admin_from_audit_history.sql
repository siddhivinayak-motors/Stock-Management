-- Audit history visibility and retention rule:
-- Super Admin activity is never stored; Admin and General Manager can view all employee activity.
create or replace function public.log_activity(
 p_module public.app_module,p_action public.app_action,p_label text,
 p_record_type text default null,p_record_id text default null,p_details jsonb default '{}'::jsonb
) returns bigint language plpgsql set search_path='' as $function$
declare v_id bigint; v_actor uuid := (select auth.uid()); v_email text;
begin
 if v_actor is null then raise exception 'Authentication required'; end if;
 if (select private.is_super_admin()) then return null; end if;
 select p.email into v_email from public.profiles p
 where p.user_id=v_actor and p.status='active' and p.is_super_admin=false;
 if v_email is null then raise exception 'Active non-super-admin employee profile required'; end if;
 insert into public.audit_logs(actor_id,actor_email,module,action,action_label,record_type,record_id,details)
 values(v_actor,v_email,p_module,p_action,p_label,p_record_type,p_record_id,coalesce(p_details,'{}'::jsonb))
 returning id into v_id;
 return v_id;
end; $function$;
revoke all on function public.log_activity(public.app_module,public.app_action,text,text,text,jsonb) from public,anon;
grant execute on function public.log_activity(public.app_module,public.app_action,text,text,text,jsonb) to authenticated;
drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert to authenticated
with check(actor_id=(select auth.uid()) and not (select private.is_super_admin())
 and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.status='active' and p.is_super_admin=false));
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
using(not (select private.is_super_admin()) and (
 exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.status='active' and p.designation in ('Admin','General Manager'))
 or (select private.has_permission('audit_history'::public.app_module,'view'::public.app_action))
));
revoke insert,update,delete on public.audit_logs from anon,authenticated;
grant select on public.audit_logs to authenticated;
delete from public.audit_logs a using public.profiles p where p.user_id=a.actor_id and p.is_super_admin=true;
