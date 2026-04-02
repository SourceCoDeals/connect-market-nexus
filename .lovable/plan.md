

# Fix Archive Deal Button — Missing Database Column

## Problem
The "Archive Deal" button doesn't work because the code tries to set `archive_reason` on the `listings` table, but **that column doesn't exist**. The `as never` TypeScript cast hides the error at compile time, but the Supabase update fails at runtime. The error is unhandled, so the dialog just stops with no feedback.

This affects GP Partner Deals, SourceCo Deals, CapTarget Deals, ReMarketing Deals, and Archived Deals restore.

## Solution

**Add the `archive_reason` column** to the `listings` table via migration, and add error handling to the dialog.

### Step 1: Create migration
Add `archive_reason TEXT` column to `listings` table:
```sql
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS archive_reason text;
```

### Step 2: Add error handling to ArchiveDealDialog
In `src/components/admin/deals/ArchiveDealDialog.tsx`, wrap the `onConfirmArchive` call in a proper try/catch that shows a toast error instead of silently failing.

### Step 3: Remove `as never` casts
Update all archive handlers across these files to remove the unsafe `as never` cast now that the column exists:
- `src/pages/admin/remarketing/GPPartnerDeals/index.tsx`
- `src/pages/admin/remarketing/SourceCoDeals/index.tsx`
- `src/pages/admin/remarketing/ReMarketingDeals/useDealsActions.ts`
- `src/pages/admin/remarketing/CapTargetDeals/useCapTargetActions.ts`
- `src/pages/admin/deals/ArchivedDeals.tsx`

### Files Changed
- New migration: add `archive_reason` column to `listings`
- `src/components/admin/deals/ArchiveDealDialog.tsx` — add toast error handling
- 5 archive handler files — remove `as never` casts (optional cleanup, low priority)

