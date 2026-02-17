

# Fix: Re-enrichment skips deals that were previously enriched

## Problem

The `process-enrichment-queue` worker has a pre-check (lines 159-206) that looks at the `enriched_at` field on the listing. If it's already set (from a prior enrichment run), the worker marks the queue item as "completed" without actually re-processing. This is why you see "No new fields were extracted" -- the worker never ran the pipeline.

Logs confirm this:
```
Found 1 listings already enriched -- marking queue items as completed
All items were already enriched -- nothing to process
```

## Solution

When a deal is explicitly re-queued for enrichment, we need to bypass that skip logic. Two changes:

### 1. Add a `force` flag to enrichment queue rows

In `queueDealEnrichment` (`src/lib/remarketing/queueEnrichment.ts`), add a `force: true` column to the upserted rows so the worker knows this is an intentional re-enrichment, not a duplicate.

### 2. Update the worker pre-check to respect the `force` flag

In `process-enrichment-queue/index.ts` (lines 159-206), modify the skip logic so that items with `force = true` are never skipped, even if `enriched_at` is already set. Only auto-queued or duplicate items without the force flag get the fast-path completion.

### 3. Database: add `force` column to enrichment_queue

A simple boolean column with a default of `false`.

### 4. Same fix for buyer enrichment queue (if applicable)

Check `process-buyer-enrichment-queue` for the same pattern and apply the force flag there too.

## Technical Details

**Migration:**
```sql
ALTER TABLE public.enrichment_queue
  ADD COLUMN IF NOT EXISTS force boolean DEFAULT false;

ALTER TABLE public.buyer_enrichment_queue
  ADD COLUMN IF NOT EXISTS force boolean DEFAULT false;
```

**queueEnrichment.ts changes:**
- `queueDealEnrichment`: set `force: true` in upserted rows
- `queueBuyerEnrichment`: set `force: true` in upserted rows

**Worker changes (process-enrichment-queue/index.ts, ~line 168-193):**
- Filter the "already enriched" skip to only apply when `force` is not true
- After processing a forced item, reset `force` to `false`

## Result

Clicking "Enrich" on a previously-enriched deal will actually re-run the full pipeline (website scraping, transcript processing, LinkedIn/Google) and merge any new data from the 19 transcripts.

