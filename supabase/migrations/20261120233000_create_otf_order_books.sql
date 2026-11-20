create table if not exists public.otf_order_books (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  department text not null default 'Personal' check (department in ('Personal','EV','Commercial','LLM')),
  quotation_id uuid not null references public.quotations(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  customer_name text not null,
  phone text not null,
  address text,
  city text,
  district text,
  customer_gstin text,
  aadhaar_number text,
  pan_number text,
  enquiry_number text,
  customer_id text,
  invoice_number text,
  booking_amount numeric(14,2) not null default 0 check (booking_amount >= 0),
  booking_date date not null default current_date,
  hpa text,
  dob date,
  marriage_anniversary date,
  email text,
  nominee text,
  nominee_relationship text,
  nominee_age integer,
  chassis_number text not null,
  engine_number text,
  model text not null,
  variant text,
  colour text,
  sales_person text,
  quotation_snapshot jsonb not null default '{}'::jsonb,
  vehicle_snapshot jsonb not null default '{}'::jsonb,
  exchange_details jsonb not null default '{}'::jsonb,
  accessories_details jsonb not null default '[]'::jsonb,
  payment_details jsonb not null default '[]'::jsonb,
  terms text[] not null default array[]::text[],
  status text not null default 'BOOKED' check (status in ('BOOKED','CANCELLED')),
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists otf_order_books_phone_idx on public.otf_order_books (phone, department);
create index if not exists otf_order_books_quote_idx on public.otf_order_books (quotation_id);
create index if not exists otf_order_books_chassis_idx on public.otf_order_books (chassis_number);
create index if not exists otf_order_books_created_at_idx on public.otf_order_books (created_at desc);
alter table public.otf_order_books enable row level security;
drop policy if exists otf_order_books_select on public.otf_order_books;
create policy otf_order_books_select on public.otf_order_books
for select to authenticated
using (
  private.can_access_department(department)
  and private.can_view_quotation_creator(created_by)
  and private.has_permission('quotation_management'::app_module,'view'::app_action)
);
drop policy if exists otf_order_books_insert on public.otf_order_books;
create policy otf_order_books_insert on public.otf_order_books
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_access_department(department)
  and private.has_permission('quotation_management'::app_module,'create'::app_action)
);
drop policy if exists otf_order_books_update on public.otf_order_books;
create policy otf_order_books_update on public.otf_order_books
for update to authenticated
using (
  private.can_access_department(department)
  and private.has_permission('quotation_management'::app_module,'edit'::app_action)
)
with check (
  private.can_access_department(department)
  and private.has_permission('quotation_management'::app_module,'edit'::app_action)
);
grant select, insert, update on public.otf_order_books to authenticated;
