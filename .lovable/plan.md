

# Fix: "column reference 'target_user_id' is ambiguous" on User Deletion

## Root Cause

The `delete_user_completely` function has a parameter named `target_user_id`. The `permission_audit_log` table also has a column named `target_user_id`. This line in the function:

```sql
DELETE FROM public.permission_audit_log WHERE target_user_id = target_user_id;
```

...is ambiguous — Postgres doesn't know if `target_user_id` on the right side refers to the function parameter or the table column. It resolves to `column = column` (always true), which would delete all rows, so Postgres raises the ambiguity error instead.

## Fix

Create a migration that recreates the function, renaming the parameter to `_target_user_id` (prefixed with underscore) to eliminate the naming conflict. Every reference to the parameter inside the function body gets the underscore prefix.

The critical line becomes:
```sql
DELETE FROM public.permission_audit_log WHERE target_user_id = _target_user_id;
```

Additionally, the `permission_audit_log` table also has a `changed_by` column that could reference the deleted user — we should also clean those rows or nullify that reference.

## File

| File | Change |
|------|--------|
| New migration SQL | `CREATE OR REPLACE FUNCTION public.delete_user_completely(_target_user_id uuid)` — rename parameter, update all internal references |

## Frontend

The RPC call in the frontend passes `target_user_id` as the parameter name. This must be updated to `_target_user_id` to match the renamed parameter.

| File | Change |
|------|--------|
| Frontend file calling `supabase.rpc('delete_user_completely', ...)` | Change `{ target_user_id: ... }` to `{ _target_user_id: ... }` |

