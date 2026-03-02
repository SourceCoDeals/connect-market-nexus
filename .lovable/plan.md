

## Fix: Connection Requests Broken Due to Dropped Database Tables

### Root Cause

A cleanup migration (`20260503000000_drop_unused_tables.sql`) dropped the `connection_request_stages` table, but **three database triggers** on the `connection_requests` table still reference it. Every time a user tries to submit a connection request, the INSERT fires the `auto_assign_connection_request_stage` trigger, which queries the now-missing table -- causing the entire operation to fail with the error "relation public.connection_request_stages does not exist".

The same migration also dropped `generic_email_domains`, causing secondary errors in admin queries that reference it.

### Affected Triggers

1. **`trigger_auto_assign_connection_request_stage`** -- fires on INSERT, queries `connection_request_stages` to assign a pipeline stage. This is the primary blocker for new connection requests.
2. **`on_connection_request_stage_update`** -- fires on UPDATE when `pipeline_stage_id` changes, queries `connection_request_stages` for stage name. Blocks status updates.
3. The function `calculate_buyer_priority_score` is called by trigger 1 but is harmless on its own.

### Fix Plan

**1. Create a new migration to drop the broken triggers and clean up their functions**

New migration file: `supabase/migrations/20260503100000_fix_broken_triggers.sql`

- `DROP TRIGGER IF EXISTS trigger_auto_assign_connection_request_stage ON connection_requests`
- `DROP TRIGGER IF EXISTS on_connection_request_stage_update ON connection_requests`
- `DROP FUNCTION IF EXISTS auto_assign_connection_request_stage()`
- `DROP FUNCTION IF EXISTS notify_user_on_stage_change()`

These triggers served the old "connection request pipeline" feature which has been fully replaced by the deals pipeline. They are no longer needed.

**2. Fix the `__none__` UUID error in MessageCenter**

In `src/pages/admin/MessageCenter.tsx` (line 79), the query uses `'__none__'` as a fallback value in `.in()` for a UUID column, causing a Postgres type error. Replace with an empty array guard:

```ts
// Before
.in('connection_request_id', requestIds.length > 0 ? requestIds : ['__none__'])

// After  
if (requestIds.length === 0) return { data: [], error: null };
// ...then proceed with the .in() using requestIds directly
```

Same fix needed in `src/pages/BuyerMessages/useMessagesData.ts` (line 73).

**3. Verify the buyer "My Deals" tab still works**

The `/my-deals` page (`MyRequests.tsx`) uses `useUserConnectionRequests()` which queries `connection_requests` filtered by `user_id`. Once the INSERT trigger is fixed, new requests will flow through and appear here. No code changes needed for this page -- the issue was purely that no new requests could be created.

### Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/20260503100000_fix_broken_triggers.sql` | **New file**: Drop the 2 broken triggers and their functions |
| `src/pages/admin/MessageCenter.tsx` | Fix `__none__` UUID fallback on line 79 |
| `src/pages/BuyerMessages/useMessagesData.ts` | Fix `__none__` UUID fallback on line 73 |

### What This Fixes

- Users can submit connection requests again (the "Request Access" button will work)
- Requests will appear in the buyer's "My Deals" tab
- Requests will flow into the admin Connection Requests and Message Center
- The admin Message Center and buyer Messages pages won't throw UUID parse errors
- The `connection_request_stages` error spam in Postgres logs will stop

