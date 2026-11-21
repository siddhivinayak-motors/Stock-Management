begin;

-- Keep one permissive INSERT policy for hold requests. Stock editors with the
-- explicit stock_register.edit permission may submit requests from the edit dialog.
drop policy if exists holds_insert_stock_editors on public.stock_holds;
drop policy if exists holds_insert on public.stock_holds;

create policy holds_insert
on public.stock_holds
for insert
to authenticated
with check (
  private.is_super_admin()
  or private.has_permission('stock_register'::public.app_module, 'edit'::public.app_action)
  or private.has_permission('backup_restore'::public.app_module, 'restore'::public.app_action)
  or exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and p.designation = any(array['Executive','Reception','Receptionist','Driver'])
  )
);

-- Restrictive policy must express the same permitted submitters; otherwise it
-- silently blocks the stock-editor permission above.
drop policy if exists stock_holds_insert_role_gate on public.stock_holds;

create policy stock_holds_insert_role_gate
on public.stock_holds
as restrictive
for insert
to authenticated
with check (
  private.is_super_admin()
  or private.has_permission('stock_register'::public.app_module, 'edit'::public.app_action)
  or private.has_permission('backup_restore'::public.app_module, 'restore'::public.app_action)
  or exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and p.designation = any(array['Executive','Reception','Receptionist','Driver'])
  )
);

-- This is a trigger-only validator, not a public RPC endpoint.
revoke all on function public.validate_otf_order_book_vehicle() from public, anon, authenticated;
grant execute on function public.validate_otf_order_book_vehicle() to postgres;

-- Cover the two OTF creator/updater foreign keys flagged by the database advisor.
create index if not exists otf_order_books_created_by_idx
  on public.otf_order_books(created_by);
create index if not exists otf_order_books_updated_by_idx
  on public.otf_order_books(updated_by);

commit;
