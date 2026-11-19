# Siddhivinayak Stock Management — Supabase Backend

Supabase project: `tvpaxdvqvwpblcfssgsj` (Mumbai / ap-south-1).

## Deployed components
- Supabase schema and Row Level Security (RLS) for profiles, employee permissions, vehicles, quotations, quotation line items, price list versions/items, stock holds, stock import batches and audit logs.
- Individual Email + Password identities through Supabase Auth.
- Initial Super Admin profile for the existing Auth user `anjararakesh98@gmail.com`.
- Per-user, per-module permissions with view/create/edit/delete/approve/manage-users/export/restore actions.
- Protected `employee-admin` Edge Function (JWT required) for employee invitation, profile updates and deactivation. The function uses the server-side service-role key only; never expose that key in browser code.
- Browser runtime adapter loaded from the main `index.html` without changing its visual theme.
- GitHub Actions syntax/type-check workflow at `.github/workflows/backend-validation.yml`.

## Operational workflows connected
- Email/password login and password reset.
- Stock create/list/edit/delete and department filtering.
- OEM stock report import preview/commit.
- Quotation save, approval and print count.
- Department price list publication/version history.
- Stock hold request/approval/rejection with database-trigger stock-stage synchronization.
- Employee invitation, profile edit, deactivation and individual permission changes.
- Audit read/search/export.
- Operational data backup/restore (profiles, Auth identities and permission grants are deliberately excluded from restore).

## Data and security
- No demo/seed stock, quote, hold or price-list data was inserted into the database.
- RLS is enabled on all public operational tables. Permission checks use helper functions in a non-exposed private schema.
- The service-role key is not included in GitHub browser code.
- Legacy local-only quote/workspace cache keys are removed by the Supabase runtime on startup.

## Remaining production validation / limitations
1. Run an end-to-end browser test with the Super Admin's real account and then test representative employee accounts. GitHub CI checks JavaScript syntax and Edge Function types; it is not a substitute for browser testing.
2. Configure and verify Auth email delivery/redirect URLs for employee invitations and password reset. Enable leaked-password protection in Supabase Auth settings.
3. Common Excel reconciliation currently matches exact full chassis numbers only; unmatched/ambiguous rows remain untouched. Validate the actual Tally and manager workbook column headers before business use.
4. Retail reporting is intentionally disabled until an authoritative retail-sale date/source is identified. OEM invoice date must not be treated as retail date.
5. Operational restore is limited to business tables; no Auth users or employee permission grants are restored. Global reset is intentionally disabled pending an audited server-side design.
6. Verify the live hosting/PWA update path and Android install/session persistence before staff rollout.

## Database tables
`profiles`, `employee_permissions`, `vehicles`, `quotations`, `quotation_items`, `price_list_versions`, `price_list_items`, `stock_holds`, `stock_import_batches`, `audit_logs`.
