alter table public.quotations
  add column if not exists customer_gstin text,
  add column if not exists sales_mobile text;
