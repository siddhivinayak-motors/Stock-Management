-- Restore scoped UPDATE access for quotation editing and enforce approval-gated totals.
drop policy if exists quotations_update_for_edit on public.quotations;
create policy quotations_update_for_edit
on public.quotations
for update
to authenticated
using (
  private.can_view_quotation_creator(created_by, department)
  and (
    private.has_permission('quotation_management'::app_module, 'edit'::app_action)
    or (
      created_by = (select auth.uid())
      and private.has_permission('quotation_management'::app_module, 'create'::app_action)
    )
  )
)
with check (
  private.can_access_department(department)
  and private.can_view_quotation_creator(created_by, department)
  and (
    private.has_permission('quotation_management'::app_module, 'edit'::app_action)
    or (
      created_by = (select auth.uid())
      and private.has_permission('quotation_management'::app_module, 'create'::app_action)
    )
  )
);

create or replace function public.guard_quotation_discount_on_insert()
returns trigger
language plpgsql
set search_path = 'public','private'
as $function$
begin
  new.status := 'Pending';
  new.approved_by := null;
  new.approved_at := null;
  new.total := greatest(0, coalesce(new.subtotal,0));
  return new;
end;
$function$;

create or replace function public.guard_quotation_review_fields()
returns trigger
language plpgsql
set search_path = 'public','private'
as $function$
declare
  v_designation text;
  v_is_super_admin boolean;
  v_can_review boolean;
  v_financial_changed boolean;
  v_net_total numeric;
  v_approved boolean;
begin
  v_net_total := greatest(0,coalesce(new.subtotal,0)-coalesce(new.discount,0));
  select designation,coalesce(is_super_admin,false)
    into v_designation,v_is_super_admin
  from public.profiles where user_id=auth.uid();
  v_can_review := coalesce(v_is_super_admin,false)
    or v_designation in ('Manager','General Manager','Admin');
  v_financial_changed := new.subtotal is distinct from old.subtotal
    or new.discount is distinct from old.discount;

  if v_financial_changed then
    new.status := 'Pending';
    new.approved_by := null;
    new.approved_at := null;
    new.total := greatest(0,coalesce(new.subtotal,0));
    return new;
  end if;

  if new.status is distinct from old.status
     or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at then
    if not v_can_review then
      if new.status='Pending' and old.status in ('Approved','Denied')
         and new.approved_by is null and new.approved_at is null then
        new.total := greatest(0,coalesce(new.subtotal,0));
        return new;
      end if;
      raise exception 'Only Manager, General Manager, Admin and Super Admin can approve or deny quotations.';
    end if;
  end if;

  v_approved := lower(coalesce(new.status,''))='approved'
    and new.approved_by is not null and new.approved_at is not null;
  new.total := case when v_approved then v_net_total else greatest(0,coalesce(new.subtotal,0)) end;
  return new;
end;
$function$;

do $migration$
declare
  v_def text;
  v_old text := $old$subtotal = greatest(0, coalesce(nullif(p_quote->>'subtotal','')::numeric, 0) - coalesce(nullif(p_quote->>'discount','')::numeric, 0)),$old$;
  v_new text := $new$subtotal = greatest(0, coalesce(nullif(p_quote->>'subtotal','')::numeric, 0)),$new$;
begin
  v_def := pg_get_functiondef('public.upsert_customer_vehicle_quotation(jsonb,jsonb)'::regprocedure);
  if position(v_old in v_def)=0 then
    raise exception 'Expected upsert subtotal expression was not found; migration stopped without changing the function.';
  end if;
  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end;
$migration$;
