-- Enable database change events for live quotation register refresh.
-- Row-level security continues to govern which quotation rows each employee can receive.
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotation_items;
