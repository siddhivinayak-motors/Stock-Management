-- Restrict quotation visibility for branch Managers while preserving existing role rules.
-- Managers see quotations created by employees whose profiles.city matches their own city.
-- Executives/Reception/Drivers remain limited to their own quotations.
-- Admin, General Manager, HR, DMS, Accountant/Accounts and Super Admin retain existing broad visibility.

create or replace function private.can_view_quotation_creator(p_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select case
      when viewer.is_super_admin is true then true
      when lower(trim(coalesce(viewer.designation, ''))) = 'manager' then exists (
        select 1
        from public.profiles creator
        where creator.user_id = p_created_by
          and nullif(trim(coalesce(viewer.city, '')), '') is not null
          and lower(trim(coalesce(creator.city, ''))) = lower(trim(viewer.city))
      )
      when lower(trim(coalesce(viewer.designation, ''))) = any (
        array['admin','general manager','hr','dms','accountant','accounts']
      ) then true
      when lower(trim(coalesce(viewer.designation, ''))) = any (
        array['executive','reception','receptionist','driver']
      ) then p_created_by = (select auth.uid())
      else false
    end
    from public.profiles viewer
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.deleted_at is null
  ), false);
$function$;

revoke all on function private.can_view_quotation_creator(uuid) from public;
grant execute on function private.can_view_quotation_creator(uuid) to authenticated;

drop policy if exists quotations_select on public.quotations;
create policy quotations_select
on public.quotations
for select
to authenticated
using (private.can_view_quotation_creator(created_by));
