drop policy if exists vehicle_exit_records_restore_update on public.vehicle_exit_records;
create policy vehicle_exit_records_restore_update
  on public.vehicle_exit_records
  for update to authenticated
  using (private.has_permission('backup_restore'::app_module, 'restore'::app_action))
  with check (private.has_permission('backup_restore'::app_module, 'restore'::app_action));

grant update on public.vehicle_exit_records to authenticated;
