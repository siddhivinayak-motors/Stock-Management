-- Store OTF branch/unit independently from customer city.
alter table public.otf_order_books add column if not exists unit_city text;

-- Explicitly map the previously unassigned OTF to Bhavnagar.
update public.otf_order_books
set unit_city = 'Bhavnagar', updated_at = now()
where order_number = 'OTF-PV-20261121-082881-KHW'
  and (unit_city is null or btrim(unit_city) = '');

-- Manager visibility uses the explicit unit mapping first, then legacy city fallback.
drop policy if exists otf_order_books_select on public.otf_order_books;
create policy otf_order_books_select
on public.otf_order_books
for select
to authenticated
using (
  (select private.can_view_otf_record(
    otf_order_books.department,
    otf_order_books.created_by,
    coalesce(nullif(btrim(otf_order_books.unit_city), ''), otf_order_books.city)
  ))
  and (select private.has_permission('otf_management'::app_module, 'view'::app_action))
);
