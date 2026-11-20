create index if not exists vehicles_retailed_by_idx on public.vehicles (retailed_by) where retailed_by is not null;
