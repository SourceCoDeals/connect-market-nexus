
# CTO Audit Fix Plan: Enrichment & Scoring Infrastructure

This plan addresses every issue identified in the audit, prioritized by severity. No cosmetic changes — only functional fixes.

---

## CRITICAL Fix 1: `force` flag not passed to `enrich-deal` (transcripts won't re-extract)

**Root cause confirmed:** `enrichmentPipeline.ts` line 75 calls `enrich-deal` with `{ dealId, skipExternalEnrichment: true }` but never includes `forceReExtract`. The `enrich-deal` function reads `forceReExtract` from the request body (line 134) and defaults to `false`, meaning previously-extracted transcript data is never re-run even when the queue item has `force=true`.

**Fix:** The `EnrichmentPipelineInput` type must carry the `force` flag, and `process-enrichment-queue/index.ts` must pass it through to `runListingEnrichmentPipeline`, which then passes `forceReExtract: true` to the `enrich-deal` call.

Files changed:
- `supabase/functions/process-enrichment-queue/enrichmentPipeline.ts` — add `force?: boolean` to `EnrichmentPipelineInput`, pass `forceReExtract: input.force` in the `enrich-deal` call body
- `supabase/functions/process-enrichment-queue/index.ts` — pass `force: item.force ?? false` into the pipeline input object (line ~325)

---

## HIGH Fix 2: Buyer worker ignores `force` flag entirely

**Root cause confirmed:** `process-buyer-enrichment-queue/index.ts` line 144 selects `id, buyer_id, universe_id, status, attempts, queued_at` — `force` is not even fetched. The `enrich-buyer` call at line 229 only sends `{ buyerId, skipLock: true }`. The buyer worker also has a freshness check (lines 172-191) that skips buyers updated within the last 5 minutes based on `data_last_updated`, which will silently skip a forced re-enrichment if the buyer was recently processed.

**Fix:**
- Add `force` to the select query (line 144)
- Pass `forceReExtract: item.force === true` in the `enrich-buyer` fetch body (line 229)
- Bypass the freshness check when `item.force === true` (lines 172-191)
- Reset `force: false` on completion update (line 286-292)

Files changed:
- `supabase/functions/process-buyer-enrichment-queue/index.ts`

---

## HIGH Fix 3: Partial unique indexes are incompatible with PostgREST `onConflict`

**Root cause confirmed:** The database has partial unique indexes:
```
uq_scoring_queue_deal: (universe_id, listing_id, score_type) WHERE listing_id IS NOT NULL
uq_scoring_queue_alignment: (universe_id, buyer_id, score_type) WHERE buyer_id IS NOT NULL
```

PostgREST's `onConflict` parameter does **not** support partial indexes. When `queueScoring.ts` calls `.upsert(rows, { onConflict: "universe_id,listing_id,score_type" })`, PostgREST looks for a non-partial unique constraint matching those exact columns. It won't find one, so the behavior is undefined — it may silently insert duplicates or throw a constraint error, depending on the Postgres version and PostgREST behavior.

**Fix:** Replace the partial unique indexes with full unique indexes, or add unconditional unique constraints alongside. Since `listing_id` and `buyer_id` can both be null in the same table (deal rows have no buyer_id, alignment rows have no listing_id), we need to use partial indexes but must not use PostgREST upsert against them. Instead, use a manual upsert pattern:

1. Attempt insert
2. On conflict (23505), update the existing row

Or simpler: add full non-partial unique constraints using `COALESCE` or move to separate tables. The cleanest fix is to **add real unique constraints** (non-partial) by making null columns use a sentinel value, or to **use an RPC for the upsert** that runs a proper `INSERT ... ON CONFLICT DO UPDATE` with the `WHERE` clause.

**Chosen approach:** Add a database migration that creates a proper `INSERT ... ON CONFLICT` RPC function for scoring queue upserts, and update `queueScoring.ts` to call `supabase.rpc('upsert_scoring_queue_items', { rows })` instead of `.upsert()`.

Alternatively (simpler): Replace the two partial indexes with one composite unique index that uses `COALESCE(listing_id, buyer_id)` — but this is not directly supported either. 

**Best practical fix:** Drop the partial indexes and replace with two separate upsert RPCs: one for deal scoring (`uq_scoring_queue_deal` becomes enforced via RPC), one for alignment. The RPC uses `INSERT ... ON CONFLICT (universe_id, listing_id, score_type) WHERE listing_id IS NOT NULL DO UPDATE SET status = EXCLUDED.status, updated_at = now()`.

Files changed:
- New migration: drop partial indexes, create RPC `upsert_deal_scoring_queue` and `upsert_alignment_scoring_queue`
- `src/lib/remarketing/queueScoring.ts` — replace `.upsert()` calls with `supabase.rpc('upsert_deal_scoring_queue', ...)` and `supabase.rpc('upsert_alignment_scoring_queue', ...)`

---

## MODERATE Fix 4: Auto-enrichment always sets `force=true` via `queueDealEnrichment`

**Root cause confirmed:** `useAutoEnrichment.ts` (line 131) calls `queueDealEnrichment([dealId])`, which unconditionally sets `force: true` on every queued row. This means page-load auto-enrichment (triggered for stale/missing-fields deals) forces a full transcript re-extraction on every visit, which is wasteful and bypasses the worker's own freshness/staleness logic.

**Fix:** Add an optional `force` parameter to `queueDealEnrichment` (default `false`) and `queueBuyerEnrichment` (default `false`). Manual UI-triggered calls pass `force: true`; `useAutoEnrichment` passes no argument (defaults to `false`).

Files changed:
- `src/lib/remarketing/queueEnrichment.ts` — add `force = true` parameter to both functions (keep `true` as default for backward compat with existing callers, but allow override)
- `src/hooks/useAutoEnrichment.ts` — pass `force: false` explicitly

---

## MODERATE Fix 5: Dead code in `useBuyerEnrichment.ts`

**Root cause confirmed:** The hook contains `parseInvokeError` (lines 61-96), `BATCH_SIZE`/`BATCH_DELAY_MS` constants (lines 47-48), `AbortState` interface (lines 51-55), and `updateStatus` callback (lines 110-116) — all completely unreferenced after the migration to the queue system. The hook also imports `invokeWithTimeout` (line 3) which is unused.

**Fix:** Remove all dead code. The hook's retained surface: `progress` state, `enrichBuyers`, `cancel`, `reset`. Clean up unused imports too.

Files changed:
- `src/hooks/useBuyerEnrichment.ts`

---

## LOW Fix 6: No completion feedback for background enrichment

**Current state:** After clicking "Enrich", users see a single toast "Deal queued for background enrichment" and then nothing until they manually refresh. The previous polling infrastructure was removed rather than adapted.

**Fix:** Add a lightweight polling hook that subscribes to `enrichment_queue` status for the specific `listing_id`. When the row transitions from `pending/processing` to `completed/failed`, fire a toast notification and invalidate the deal query to auto-refresh the page data.

This is lightweight: poll every 5 seconds, stop after `completed`/`failed` or after 5 minutes.

Files changed:
- New file: `src/hooks/useEnrichmentQueueStatus.ts` — polls `enrichment_queue` for a specific `listing_id`
- `src/components/remarketing/DealTranscriptSection.tsx` — use the hook after queuing to fire completion toast + invalidate deal query

---

## Technical Summary Table

```text
Fix | Severity | Files Changed
----|----------|----------------------------------------------
1   | CRITICAL | enrichmentPipeline.ts, process-enrichment-queue/index.ts
2   | HIGH     | process-buyer-enrichment-queue/index.ts
3   | HIGH     | new migration (RPC), queueScoring.ts
4   | MODERATE | queueEnrichment.ts, useAutoEnrichment.ts
5   | MODERATE | useBuyerEnrichment.ts (cleanup only)
6   | LOW      | new hook, DealTranscriptSection.tsx
```

**Execution order:** Fix 3 migration runs first (no app code depends on it yet), then Fixes 1 & 2 (edge function deploys), then Fixes 4 & 5 (frontend), then Fix 6 (frontend).
