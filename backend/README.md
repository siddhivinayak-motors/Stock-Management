# Siddhivinayak Stock Management — Supabase Backend

Supabase project: `tvpaxdvqvwpblcfssgsj` (Mumbai / ap-south-1).

## Current state
- Core schema, enum types, indexes, and RLS policies are deployed in Supabase.
- Initial Super Admin profile is provisioned for the existing Auth user `anjararakesh98@gmail.com`.
- Modules: Dashboard, Stock Register, Stock Hold Management, Price List Management, Quotation Management, Employee Management, Common Excel Upload, Backup & Restore, Audit History, Retail Reports.
- Employee permissions are per-user and per-module; actions: view, create, edit, delete, approve, manage_users, export, restore.
- Do not put the Supabase service-role key in browser code.
- Do not treat this schema as a completed frontend integration. The existing index.html still contains demo/localStorage handlers and requires explicit adapter wiring and runtime verification.

## Tables
profiles, employee_permissions, vehicles, quotations, quotation_items, price_list_versions, price_list_items, stock_holds, stock_import_batches, audit_logs.

## Auth
Email + Password using Supabase Auth. Employee creation must be performed by a trusted server-side Edge Function using the service role key, and must check the caller's database permission before calling Auth Admin APIs.

## Required follow-up
1. Add Auth UI and Supabase JS client initialization to the current HTML without changing visible layout except the required login surface.
2. Replace localStorage writes in quotation, price-list, hold, stock import, permission and audit workflows with database calls.
3. Add a protected Edge Function for creating/inviting and deactivating employees.
4. Wire export/backup and restore to authenticated workflows.
5. Verify sign-in, RLS, CRUD, import, quote save/print, hold approval, permission enforcement, audit rows, and Android PWA persistence in a real browser session.
6. Enable leaked-password protection in Supabase Auth settings.

