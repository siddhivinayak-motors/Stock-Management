-- Keep quotation.total and amount_words aligned with the two discount rows.
-- The application sends subtotal, aggregate discount, and itemized Retail/Exchange rows.
do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='upsert_customer_vehicle_quotation';

  if v_def is null then
    raise exception 'upsert_customer_vehicle_quotation() was not found';
  end if;

  v_old := 'total = coalesce(nullif(p_quote->>''subtotal'','''')::numeric, 0),';
  v_new := 'total = greatest(0, coalesce(nullif(p_quote->>''subtotal'','''')::numeric, 0) - coalesce(nullif(p_quote->>''discount'','''')::numeric, 0)),';
  if position(v_old in v_def) > 0 then
    v_def := replace(v_def, v_old, v_new);
  end if;

  v_old := 'coalesce(nullif(p_quote->>''subtotal'','''')::numeric,0), coalesce(p_quote->>''amountWords'',''''),';
  v_new := 'greatest(0, coalesce(nullif(p_quote->>''subtotal'','''')::numeric,0) - coalesce(nullif(p_quote->>''discount'','''')::numeric,0)), coalesce(p_quote->>''amountWords'',''''),';
  if position(v_old in v_def) > 0 then
    v_def := replace(v_def, v_old, v_new);
  end if;

  execute v_def;
end $$;

-- Keep the discounted net total even while the quotation is pending approval.
-- Financial edits still clear prior approval and return the quotation to Pending.
create or replace function public.guard_quotation_review_fields()
returns trigger
language plpgsql
set search_path to 'public','private'
as $function$
declare
  v_designation text;
  v_is_super_admin boolean;
  v_can_review boolean;
  v_financial_changed boolean;
  v_net_total numeric;
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
    new.total := v_net_total;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at then
    if not v_can_review then
      if new.status='Pending' and old.status in ('Approved','Denied')
         and new.approved_by is null and new.approved_at is null then
        new.total := v_net_total;
        return new;
      end if;
      raise exception 'Only Manager, General Manager, Admin and Super Admin can approve or deny quotations.';
    end if;
  end if;

  new.total := v_net_total;
  return new;
end;
$function$;

create or replace function public.guard_quotation_discount_on_insert()
returns trigger
language plpgsql
set search_path to 'public','private'
as $function$
begin
  new.status := 'Pending';
  new.approved_by := null;
  new.approved_at := null;
  new.total := greatest(0,coalesce(new.subtotal,0)-coalesce(new.discount,0));
  return new;
end;
$function$;
