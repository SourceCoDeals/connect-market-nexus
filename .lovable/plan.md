

# Fix: Use upsert for scoring queue to prevent duplicate key errors

## Problem

The same unique constraint issue we just fixed for the enrichment queue also exists in the **scoring queue**. Both `queueDealScoring` and `queueAlignmentScoring` in `src/lib/remarketing/queueScoring.ts` use `.insert()`, which will fail if a row already exists for that deal/buyer (e.g., from a previous completed or failed scoring run).

## Scope

Only one file needs updating: `src/lib/remarketing/queueScoring.ts`

- **Line 49**: Change `.insert(rows)` to `.upsert(rows, { onConflict: "...", ignoreDuplicates: false })` for deal scoring
- **Line 94**: Same change for alignment scoring

The `onConflict` columns will depend on the table's unique constraints (likely a composite of `universe_id` + `listing_id` + `score_type` for deals, and `universe_id` + `buyer_id` + `score_type` for alignment).

## Already Fixed (no action needed)

- `enrichment_queue` -- just fixed (uses upsert on `listing_id`)
- `buyer_enrichment_queue` -- already uses upsert on `buyer_id`

## Result

Re-scoring deals or buyers will reset their queue status to "pending" instead of crashing with a constraint violation.

