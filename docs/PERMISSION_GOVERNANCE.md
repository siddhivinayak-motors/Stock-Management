# Permission Governance — Mandatory Project Rule

This rule applies to every module, screen, action, API, database policy, import/export flow, and future change in Siddhivinayak Stock Management.

## 1. Permission source of truth
- The permissions explicitly assigned to an employee in Employee Management are authoritative.
- If an employee has a module/action permission, the application must allow that exact action.
- Do not block an allowed action because of role/designation defaults, hard-coded role lists, UI-only restrictions, or assumptions about what a Manager/HR/Executive should normally do.
- Do not grant actions that were not assigned.
- Check the exact module + action at every layer: navigation/UI, browser handler, server/Edge Function, and database/RLS/RPC.

## 2. Department scope
- A Department Manager may manage/create employees only inside the Manager's own primary department.
- Department scope limits which records and employees are accessible; it must not silently remove explicitly granted actions within that department.
- An employee must not see, create, edit, delete, upload, approve, or export data for another department unless that department is explicitly assigned and permitted.
- Admin / General Manager cross-department access follows their explicitly assigned authority and permissions.

## 3. Employee creation and permission delegation
- If Employee Management > Create is granted, the employee can create employees within their allowed department scope.
- Permission editing/delegation must follow the separately assigned permission-management authority. Do not assume Create automatically means permission administration.
- Never silently discard a selected permission. If delegation is not authorized, explain exactly which permission is missing and preserve the granted permissions already stored.

## 4. Required testing before deployment
For each changed module, test at minimum:
- Allowed action succeeds.
- Same action without permission is denied.
- Department boundary prevents cross-department access.
- Existing explicit permissions continue working after role/designation changes.
- UI and backend/database enforcement agree.
- Regression test with a real representative account and its actual database permissions.

## 5. Deployment discipline
- Do not report deployment as complete until the latest commit's production deployment workflow has succeeded.
- If a workflow is cancelled by a newer commit, rerun the latest build/deploy and verify the final workflow result.
- Report clearly whether the change is committed, validated, building, deployed, or still pending.
