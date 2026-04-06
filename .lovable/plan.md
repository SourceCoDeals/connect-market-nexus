

# Fix: Connection Accept Fails Due to Missing `contact_role` Column

## Root Cause

When you click "Accept" on a connection request, the status update succeeds on the `connection_requests` table, but a **database trigger** fires and fails:

**Trigger**: `trg_auto_create_deal_from_connection` calls `auto_create_deal_from_approved_connection()`

This function tries to INSERT into `deal_pipeline` with a `contact_role` column that **does not exist** on the table. The INSERT fails, the trigger rolls back, and the entire UPDATE is aborted — resulting in "Action failed."

There is also a **second trigger** (`trg_create_deal_on_request_approval` calling `create_deal_on_request_approval()`) that fires on the same event (status changed to approved). This second trigger is clean and does NOT use `contact_role`. But having two competing triggers that both try to insert into `deal_pipeline` on approval creates a race/duplicate problem.

## Fix (Single Migration)

### 1. Drop the broken trigger and function

`auto_create_deal_from_approved_connection` is the older, less sophisticated version. It:
- Uses `contact_role` (doesn't exist)
- Matches duplicates by `listing_id + contact_email` (fragile)
- Inserts into the first stage (not "Qualified")
- Doesn't set `connection_request_id` (loses linkage)
- Doesn't create activity log entries

The second trigger (`create_deal_on_request_approval`) does all of this correctly. So we drop the broken one entirely:

```sql
DROP TRIGGER IF EXISTS trg_auto_create_deal_from_connection ON public.connection_requests;
DROP FUNCTION IF EXISTS auto_create_deal_from_approved_connection();
```

### 2. No other changes needed

The surviving trigger `create_deal_on_request_approval` handles:
- Duplicate check via `connection_request_id`
- Skips placeholder-website listings
- Inserts into "Qualified" stage
- Sets NDA/fee agreement status from lead data
- Creates an activity log entry
- Links `connection_request_id` for traceability

## Secondary Issue (Not Blocking Accept)

The `listings.real_company_name does not exist` errors in the DB logs are from a **separate query** — the universal search hook (`use-universal-search.ts` line 103) selects `real_company_name` from `listings`, but the column is actually called `internal_company_name`. This should be fixed too but is unrelated to the accept failure.

## Files to Change

| File | Change |
|------|--------|
| New migration SQL | Drop broken trigger + function |
| `src/hooks/admin/use-universal-search.ts` | Replace `real_company_name` with `internal_company_name` (line 103) |

