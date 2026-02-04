
# Fix Build Error: AllDeals.tsx Priority Rank Update

## Problem

The `AllDeals.tsx` file at line 209 uses `upsert()` with only `{ id, priority_rank }`, but the Supabase-generated types require `stage_id` and `title` as mandatory fields for upsert operations.

## Root Cause

The `upsert` operation in Supabase expects all required columns to be present because it can perform an INSERT if the row doesn't exist. Since we're only updating existing deals, we should use `update()` instead.

## Solution

Change the database update from `upsert()` to individual `update()` calls (or a transaction pattern).

## Code Changes

### File: `src/pages/admin/ma-intelligence/AllDeals.tsx`

**Before (lines 207-210):**
```typescript
const { error } = await supabase.from("deals").upsert(
  updates.map((u) => ({ id: u.id, priority_rank: u.priority_rank }))
);
```

**After:**
```typescript
// Update each deal's priority_rank individually
const updatePromises = updates.map((u) =>
  supabase.from("deals").update({ priority_rank: u.priority_rank }).eq("id", u.id)
);
const results = await Promise.all(updatePromises);
const error = results.find((r) => r.error)?.error;
```

## Notes

- This fix resolves the TypeScript error by using `update()` which only requires the fields being updated
- The `priority_rank` column still needs to be added to the database via migration for the feature to work at runtime
- The edge functions are deployed and working (session-heartbeat and process-enrichment-queue show active logs)

## Database Migration Still Required

After approving this fix, you'll also need to run the migration to add the `priority_rank` column:

```sql
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS priority_rank INTEGER;
CREATE INDEX IF NOT EXISTS idx_deals_priority_rank ON public.deals(priority_rank);
```
