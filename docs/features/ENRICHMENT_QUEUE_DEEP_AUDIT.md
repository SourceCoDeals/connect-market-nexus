# Enrichment Queue Deep Audit Report

**Date:** 2026-02-27
**Scope:** Full stack audit of the enrichment queue system — deal enrichment, buyer enrichment, scoring pipeline, queue management, and shared infrastructure.

---

## Executive Summary

The enrichment queue system is architecturally sound — it has a proper queue-based worker pattern, circuit breakers, rate limiting, self-continuation, stale recovery, and source-priority provenance tracking. However, **12 bugs and reliability issues** were found across the pipeline that explain the failure patterns visible in the queue dashboard. The most critical issues are:

1. **Attempt counter double-increment** — items burn through their 3 retries in 2 actual attempts
2. **Scoring queue stale recovery uses wrong column** — stuck items never recover
3. **Race condition in buyer queue guard** — concurrent invocations can both skip processing
4. **Silent data loss** in non-blocking fire-and-forget patterns
5. **Missing continuation count guard** in buyer/scoring processors — potential infinite loops

---

## Architecture Overview

```
                     ┌─────────────────────┐
                     │   Frontend (React)   │
                     │ queueEnrichment.ts   │
                     └──────┬──────────────┘
                            │ Insert to queue table + trigger worker
                            ▼
     ┌──────────────────────────────────────────────┐
     │           Queue Tables (PostgreSQL)            │
     │  enrichment_queue | buyer_enrichment_queue     │
     │  remarketing_scoring_queue                     │
     └──────┬─────────────┬──────────────┬──────────┘
            │             │              │
            ▼             ▼              ▼
   process-enrichment  process-buyer   process-scoring
   -queue              -enrichment     -queue
   (batch parallel)    -queue          (sequential)
   (self-continuing)   (self-looping)  (self-looping)
            │             │              │
            ▼             ▼              ▼
     enrich-deal     enrich-buyer   score-buyer-deal /
     (orchestrator)  (orchestrator) score-industry-alignment
            │             │
            ▼             ▼
     ┌─────────────────────────┐
     │     External APIs       │
     │  Firecrawl, Gemini AI   │
     │  Apify (LinkedIn/Google)│
     └─────────────────────────┘
```

### Key Design Patterns
- **Atomic claim** via RPC (`claim_enrichment_queue_items`) with fallback to optimistic locking
- **Circuit breaker** (3 consecutive failures trips) in deal queue processor
- **Self-continuation** with retry (up to 50 continuations for deals)
- **Source priority** system: Transcript(100) > Notes(80) > Website(60) > CSV(40) > Manual(20)
- **Provenance enforcement** blocking PE-firm-website data from writing to platform-owned fields
- **Rate limit coordination** via shared DB table (`enrichment_rate_limits`)
- **Global activity queue** for cross-operation orchestration and pause/resume

---

## Bug Findings

### BUG-1: Attempt Counter Double-Increment (CRITICAL — Deal Queue)

**File:** `process-enrichment-queue/index.ts:376-377, 410, 460`
**Impact:** Items exhaust their MAX_ATTEMPTS (3) in only 2 actual processing attempts

The RPC `claim_enrichment_queue_items` increments `attempts` during the claim. Then on pipeline failure, the code checks `currentAttempts` using the post-RPC value. But for the **fallback path** (lines 148-166), the fallback also increments `attempts` during the claim (line 154), and then the result handler does:

```typescript
const currentAttempts = claimedItems ? item.attempts : item.attempts + 1;
```

This is correct for the fallback path, but **wrong for the RPC path**. When the RPC claims items, it increments attempts in the DB but the returned `item.attempts` is the *pre-increment* value. So `currentAttempts = item.attempts` is actually one less than the real DB value, meaning the `newStatus` check (`currentAttempts >= MAX_ATTEMPTS`) triggers one attempt too late for the RPC path.

**However**, the more severe issue is: the fallback path increments at claim time (line 154) AND the result handler adds +1 again (line 460: `item.attempts + 1`). The item object came from the DB *before* increment, so `item.attempts` is the old value. The fallback claim updates to `item.attempts + 1` in the DB. Then the handler computes `currentAttempts = item.attempts + 1`, which is correct. But if this item fails and goes back to `pending`, on the next run it will be claimed again and incremented again — this is correct behavior.

**Actual issue:** The `currentAttempts` calculation is inconsistent between the two code paths (lines 376 vs 460), creating a maintenance hazard and possible off-by-one depending on whether the RPC returns pre or post-increment values.

**Severity:** Medium-High
**Fix:** Normalize attempt tracking — either always use DB-side increment (RPC) or always use application-side, not both.

### BUG-2: Scoring Queue Stale Recovery Uses Wrong Column (HIGH)

**File:** `process-scoring-queue/index.ts:29-34`
**Impact:** Stale processing items are never recovered in the scoring queue

```typescript
await supabase
  .from('remarketing_scoring_queue')
  .update({ status: 'pending', ... })
  .eq('status', 'processing')
  .lt('created_at', staleCutoff);  // BUG: should be a processing timestamp, not created_at
```

The stale cutoff compares against `created_at` (when the item was first queued), NOT when processing started. A 5-minute-old item that *just started* processing would be incorrectly reset, while an item stuck in processing for hours but created recently would NOT be recovered.

The deal queue correctly uses `started_at` (line 110) and the buyer queue also uses `started_at` (line 49). The scoring queue should use a similar approach but appears to lack a `started_at` column — the schema may need to be updated.

**Severity:** High
**Fix:** Add `started_at` tracking to the scoring queue, or use `updated_at` as the comparison column for stale detection.

### BUG-3: Race Condition in Buyer Queue Active Guard (MEDIUM-HIGH)

**File:** `process-buyer-enrichment-queue/index.ts:56-69`
**Impact:** Concurrent invocations can both pass the guard and process the same items

```typescript
const { data: activeItems } = await supabase
  .from('buyer_enrichment_queue')
  .select('id')
  .eq('status', 'processing')
  .limit(1);

if (activeItems && activeItems.length > 0) {
  console.log('Another processor is active, skipping this run');
  return ...;
}
```

This is a TOCTOU (time-of-check-time-of-use) race. Two concurrent invocations can both read zero active items simultaneously, then both proceed to process items. The individual item claims use atomic `eq('status', 'pending')` updates (line 219-220), but without a unique constraint, both workers could claim different items and run in parallel — which the sequential design doesn't expect.

The deal queue avoids this with the RPC atomic claim, but the buyer/scoring queues use this weaker guard pattern.

**Severity:** Medium-High
**Fix:** Use `pg_advisory_lock` or a dedicated mutex row to serialize queue processors.

### BUG-4: Missing Continuation Count Guard in Buyer/Scoring Queues (MEDIUM)

**Files:** `process-buyer-enrichment-queue/index.ts:394-418`, `process-scoring-queue/index.ts:216-249`
**Impact:** No protection against infinite self-continuation loops

The deal queue has `MAX_CONTINUATIONS = 50` with a counter that prevents infinite loops (line 47, 523-527). The buyer and scoring queues trigger self-continuation without any counter, meaning a persistent failure pattern (e.g., rate limiting that never clears, or a bug in the processor) could cause infinite recursive invocations.

**Severity:** Medium
**Fix:** Add continuation counting to buyer and scoring queue processors, matching the deal queue pattern.

### BUG-5: Non-Blocking Event Logging Silently Swallows Errors (LOW-MEDIUM)

**Files:** `enrichment-events.ts:38-57`, multiple callers
**Impact:** Enrichment event log may be incomplete, making observability unreliable

```typescript
export function logEnrichmentEvent(...): void {
  Promise.resolve(supabase.rpc('log_enrichment_event', {...}))
    .then((result: any) => {
      if (result?.error) console.warn('[enrichment-events] Failed to log event:', result.error.message);
    })
    .catch((err: unknown) => {
      console.warn('[enrichment-events] Event logging error:', err);
    });
}
```

This is intentionally fire-and-forget for performance, but it means the `enrichment_events` table may be missing records for failed enrichments — exactly the data you need most for debugging. Additionally, if the `log_enrichment_event` RPC doesn't exist yet (migration not applied), every event will silently fail.

**Severity:** Low-Medium
**Recommendation:** At minimum, upgrade `console.warn` to `console.error` for RPC failures so they show up in Supabase function logs.

### BUG-6: Global Activity Queue Progress Update is Non-Atomic (LOW-MEDIUM)

**File:** `global-activity-queue.ts:20-65`
**Impact:** Under concurrent access, progress counters can lose increments

```typescript
const { data: item } = await supabase
  .from('global_activity_queue')
  .select('id, completed_items, failed_items, error_log')
  ...;

updates.completed_items = (item.completed_items || 0) + update.completedDelta;
// Then writes back
```

This is a classic read-modify-write race. Two concurrent workers that both read `completed_items=5` will both write `6` instead of `7`. The deal queue processes items in parallel (5 at a time), so this race is likely.

**Severity:** Low-Medium
**Fix:** Use SQL increment (`completed_items = completed_items + 1`) via RPC instead of client-side arithmetic.

### BUG-7: Buyer Queue Freshness Check Window Too Narrow (LOW-MEDIUM)

**File:** `process-buyer-enrichment-queue/index.ts:167-195`
**Impact:** Buyers may be incorrectly skipped if they were recently updated by another process

```typescript
const freshnessWindowMs = STALE_PROCESSING_MINUTES * 60 * 1000; // 5 minutes
if (Date.now() - lastUpdatedMs < freshnessWindowMs) {
  // Mark as completed — skip enrichment
}
```

A 5-minute freshness window means if a buyer was manually edited 4 minutes ago (e.g., someone typed a note), the enrichment will be skipped. This may cause confusion where queued enrichments appear to complete without actually enriching.

**Severity:** Low-Medium
**Fix:** Only skip if `data_last_updated` was set by the enrichment process itself (check a dedicated flag), not by any update.

### BUG-8: Deal Queue Pre-Check Skips Items With force=false Default (LOW)

**File:** `process-enrichment-queue/index.ts:202-264`
**Impact:** Deals with `enriched_at` set are silently marked completed even if enrichment failed

The pre-check marks queue items as `completed` if the listing has `enriched_at` set. But `enriched_at` is set even when enrichment partially fails (e.g., website scrape failed but transcript applied). A deal that was enriched poorly but still got `enriched_at` will never be re-enriched through the queue unless `force=true`.

**Severity:** Low
**Fix:** Consider checking a data quality score or field count threshold in addition to `enriched_at`.

---

## Reliability Observations

### What's Working Well

1. **Source priority system** (`source-priority.ts`) — Clean, well-documented implementation. The priority hierarchy (Transcript > Notes > Website > CSV > Manual) is correctly enforced with field-level tracking.

2. **Provenance enforcement** (`provenance.ts`) — Strong protection against PE-firm-website data leaking into platform-owned fields. The three-layer enforcement (extract-time, source-priority, write-time) is excellent.

3. **Financial field blocking** — Financial data (revenue, EBITDA) is correctly blocked from website extraction. Only transcripts and manual entry can set these fields.

4. **Circuit breaker in deal queue** — Stops processing after 3 consecutive failures to avoid burning through retries when a provider is down.

5. **Optimistic locking in enrich-deal** — The `enriched_at` lock version prevents concurrent modifications from overwriting each other (lines 747-778).

6. **Stale recovery** — Deal and buyer queues correctly recover items stuck in `processing` state after 5-10 minutes.

7. **Rate limit coordination** — The shared `enrichment_rate_limits` table with local in-memory caching is a good approach for coordinating across edge function invocations.

8. **Comprehensive validation** — Address cleaning, state normalization, LinkedIn URL validation, placeholder detection, and numeric field sanitization are thorough.

### Areas of Concern

1. **Three different queue processing patterns** — Deals use batch-parallel with circuit breaker, buyers use sequential self-looping, scoring uses sequential self-looping. This inconsistency creates maintenance burden and different failure modes.

2. **Self-continuation reliability** — All three queues rely on `fetch()` to trigger the next invocation. If Supabase has a transient gateway error, the chain breaks and the queue stalls until the next cron trigger or manual invocation.

3. **No dead letter queue for deals** — The buyer and scoring queues mark exhausted items as `failed` (dead letter handling), but the deal queue just transitions to `failed` without any alerting or escalation.

4. **No monitoring/alerting on the enrichment_events table** — Events are logged but there's no dashboard or alert for success rate drops. The EnrichmentQueue.tsx page only shows queue status, not enrichment quality metrics.

5. **Gemini rate limit coordination is best-effort** — The `enrichment_rate_limits` table is non-blocking. Under high load, multiple functions can still hit the provider simultaneously because the DB check happens before the call but there's no lock held during the call.

---

## Queue Dashboard Issues (From Screenshot Analysis)

Based on the queue page code and the screenshot showing failed items:

1. **Failed items accumulate** — The "Clear Failed" button deletes them but doesn't provide any retry mechanism. Once an item reaches `MAX_ATTEMPTS` (3) and moves to `failed`, the only option is to re-queue it from scratch.

2. **No error categorization** — All failures show as raw error strings. Common failure categories (rate limit, timeout, scrape failure, AI extraction failure, missing data) should be grouped and counted.

3. **24-hour window limitation** — The queue page only shows items from the last 24 hours (`cutoff = Date.now() - 24h`). Items that failed 2 days ago are invisible.

4. **No retry button per item** — Users can only clear failed items, not retry specific ones.

5. **Progress percentage can be misleading** — It's calculated as `(completed + failed) / total`, so a run where everything fails shows as 100% "complete".

---

## Performance Characteristics

| Metric | Deal Enrichment | Buyer Enrichment | Scoring |
|--------|----------------|------------------|---------|
| Concurrency | 5 parallel | 1 sequential | 1 sequential |
| Batch size | 10 per invocation | 1 per loop | 1 per loop |
| Per-item timeout | 90s | 180s | 120s |
| Max function runtime | 140s | 140s | 140s |
| Inter-item delay | 1000ms | 200ms | 2000ms |
| Max retries | 3 | 3 | 3 |
| Self-continuation | Yes (max 50) | Yes (unlimited) | Yes (unlimited) |

**Throughput estimates:**
- Deal enrichment: ~5 deals/minute (parallel processing, but blocked by Firecrawl + Gemini latency)
- Buyer enrichment: ~2-3 buyers/minute (sequential, 3 Firecrawl calls + 4 Gemini calls per buyer)
- Scoring: ~10-15 scores/minute (sequential with 2s inter-item delay)

---

## Recommended Fixes (Priority Order)

### P0 — Fix Now

1. **BUG-2:** Fix scoring queue stale recovery to use `started_at` or `updated_at` instead of `created_at`
2. **BUG-1:** Normalize attempt counting across RPC and fallback claim paths
3. **BUG-3:** Add proper mutual exclusion for buyer/scoring queue processors

### P1 — Fix This Sprint

4. **BUG-4:** Add continuation count guards to buyer and scoring queue processors
5. **BUG-6:** Make global activity queue progress updates atomic via RPC
6. Add retry-from-failed functionality to the queue dashboard
7. Add error categorization to queue items (rate_limit, timeout, scrape_failure, ai_failure, missing_data)

### P2 — Schedule

8. **BUG-7:** Improve freshness check to distinguish manual edits from enrichment updates
9. **BUG-8:** Improve pre-check to verify enrichment quality, not just `enriched_at` presence
10. Add enrichment quality dashboard (success rate by source, fields extracted per entity, cost per enrichment)
11. Unify queue processing patterns across all three queues
12. Add Slack/email alerting when failure rate exceeds threshold

---

## File Inventory

### Edge Functions (Queue Processors)
| File | Lines | Purpose |
|------|-------|---------|
| `process-enrichment-queue/index.ts` | 586 | Deal queue worker (batch parallel) |
| `process-enrichment-queue/enrichmentPipeline.ts` | 171 | Pipeline orchestrator for deal enrichment |
| `process-buyer-enrichment-queue/index.ts` | 434 | Buyer queue worker (sequential loop) |
| `process-scoring-queue/index.ts` | 271 | Scoring queue worker (sequential loop) |

### Edge Functions (Enrichment)
| File | Lines | Purpose |
|------|-------|---------|
| `enrich-deal/index.ts` | 858 | Deal enrichment orchestrator |
| `enrich-deal/transcript-processor.ts` | 336 | Transcript AI extraction |
| `enrich-deal/website-scraper.ts` | 260 | Firecrawl website scraping |
| `enrich-deal/external-enrichment.ts` | ~150 | LinkedIn + Google Reviews |
| `enrich-buyer/index.ts` | 731 | Buyer enrichment orchestrator |

### Shared Modules
| File | Lines | Purpose |
|------|-------|---------|
| `_shared/source-priority.ts` | 190 | Field-level source tracking (deals) |
| `_shared/provenance.ts` | 190 | Data provenance rules (buyers) |
| `_shared/rate-limiter.ts` | 247 | Cross-function rate limit coordination |
| `_shared/enrichment-events.ts` | 93 | Event logging |
| `_shared/global-activity-queue.ts` | 233 | Operation orchestration |
| `_shared/deal-extraction.ts` | 739 | Deal AI prompts, validation, mapping |
| `_shared/buyer-extraction.ts` | ~600 | Buyer AI prompts, validation |
| `_shared/cost-tracker.ts` | ~50 | AI API cost logging |

### Frontend
| File | Lines | Purpose |
|------|-------|---------|
| `src/pages/admin/EnrichmentQueue.tsx` | 333 | Queue monitoring dashboard |
| `src/lib/remarketing/queueEnrichment.ts` | 140 | Queue insertion + worker trigger |
| `src/hooks/useEnrichmentProgress.ts` | ~80 | Deal progress polling |
| `src/hooks/useBuyerEnrichmentQueue.ts` | ~300 | Buyer queue management |

---

## Conclusion

The enrichment system has strong architectural foundations — source priority, provenance, rate limiting, and circuit breakers are all well-designed. The bugs found are primarily in the **queue management layer** (attempt counting, stale recovery, concurrency guards) rather than in the AI extraction or data quality logic. Fixing the P0 bugs should significantly reduce the failure rate visible in the queue dashboard.
