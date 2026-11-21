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
