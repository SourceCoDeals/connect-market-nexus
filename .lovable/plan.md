

# Fix: Drop Stale Enrichment Triggers That Reference Removed Column

## Root Cause

The column `enrichment_scheduled_at` was dropped from the `listings` table (migration `20260217130000_drop_dead_columns.sql`), but **two database triggers still reference it**:

1. **`auto_enrich_new_listing`** (AFTER INSERT trigger) -- runs `UPDATE listings SET enrichment_scheduled_at = NOW()` on every new listing
2. **`auto_enrich_updated_listing`** (BEFORE INSERT/UPDATE trigger) -- sets `NEW.enrichment_scheduled_at := NOW()` on every insert/update

Every listing creation attempt hits one of these triggers and crashes with: `column "enrichment_scheduled_at" does not exist`.

## Fix

Write a single migration that:

1. Drops the two broken triggers
2. Recreates them without the `enrichment_scheduled_at` references (they still do useful work -- queuing listings for enrichment via the `enrichment_queue` table)

The triggers' core logic (inserting into `enrichment_queue`) is still valid and needed. Only the lines that stamp `enrichment_scheduled_at` need to be removed.

```text
Trigger: auto_enrich_new_listing (AFTER INSERT)
  Keep: INSERT INTO enrichment_queue ...
  Remove: UPDATE listings SET enrichment_scheduled_at = NOW() ...

Trigger: auto_enrich_updated_listing (BEFORE INSERT/UPDATE)  
  Keep: INSERT INTO enrichment_queue ...
  Remove: NEW.enrichment_scheduled_at := NOW()
```

## Downstream Impact

Once this migration runs, listing creation will succeed again, and the auto-publish flow (Marketplace tab) will work end-to-end for listings that meet all validation requirements:
- Title at least 5 characters
- Description at least 50 characters
- At least one category
- Location provided
- Revenue is a positive number
- EBITDA provided

No other code changes are needed -- the client-side auto-publish logic and edge function are already correct.

## Files to Change

| File | Change |
|------|--------|
| New migration SQL | Drop and recreate `auto_enrich_new_listing` and `auto_enrich_updated_listing` triggers/functions without `enrichment_scheduled_at` references |

