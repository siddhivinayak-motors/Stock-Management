-- Delete RPCs require an authenticated application session.
revoke all on function public.delete_stock_import_batch(uuid) from anon;
revoke all on function public.delete_otf_order_book(uuid) from anon;