# Buyer Scoring Pipeline & Recommendation Engine — Complete Audit Report

**Date:** 2026-03-01
**Branch:** `claude/audit-buyer-scoring-pipeline-RocE2`
**Status:** Read-only diagnostic — no code changes made (except this report)

---

## EXECUTIVE SUMMARY

The "freeze" reported on the Buyer Introduction History tab has been traced to a **specific failure scenario** (Scenario B/C hybrid — see Phase 3.3). The system is **architecturally sound** — it already uses a queue-based scoring pipeline with rate limiting, retry logic, and self-continuation. The freeze is caused by a combination of:

1. **Polling timeout** — The frontend polls for 3 minutes max (45 attempts × 4s). If scoring for a large universe takes longer than 3 minutes, the UI shows an error state but the "Scoring in progress" message may linger if the queue status query still returns pending items.
2. **Queue processor lock contention** — If a prior scoring run is still holding the advisory lock, a new trigger is silently skipped, and the frontend never sees scores appear.
3. **Stale global_activity_queue operations** — A stale "running" operation from a prior crash can block the drain mechanism for up to 10 minutes.
4. **Missing frontend recovery** — When the edge function trigger (`process-scoring-queue`) is fire-and-forget and fails silently, the frontend has no way to know scoring didn't actually start.

**The system does NOT fire all buyers at once.** It uses a proper queue (`remarketing_scoring_queue`) with sequential processing, 2-second inter-item delays, and rate limit coordination. This is a much better position than the initial hypothesis.

---

## PHASE 1 — TRIGGER AUDIT: WHAT FIRES ON PAGE LOAD

### 1.1 Auto-Score Trigger Investigation

**Component:** `RecommendedBuyersSection`
**File:** `src/components/remarketing/deal-detail/RecommendedBuyersSection.tsx`

**Trigger mechanism (lines 57-61):**
```tsx
useEffect(() => {
  if (hasScores === false && autoScore.status === 'idle') {
    autoScore.triggerAutoScore();
  }
}, [hasScores, autoScore.status, autoScore.triggerAutoScore]);
```

**Hook:** `useAutoScoreDeal` at `src/hooks/admin/use-auto-score-deal.ts`

| Question | Answer |
|----------|--------|
| What triggers auto-scoring? | A `useEffect` watching `hasScores` and `autoScore.status`. Fires when `hasScores === false` AND `autoScore.status === 'idle'`. |
| Is there a check before firing? | **YES** — Only fires when `hasScores === false` (no existing scores in `remarketing_scores` for this deal) AND status is `idle`. |
| Is there a check for buyer count? | **NO** — Queues scoring for ALL buyers in ALL active universes regardless of count. |
| Is there a debounce? | **YES** — `triggeredRef.current` flag prevents re-firing within the same component mount. |
| Does it fire again on re-navigate? | **YES** — `triggeredRef` resets on `listingId` change (line 446-450). However, `hasScores` will be `true` if scores already exist, so the `useEffect` won't trigger. |

### 1.2 What Does the Auto-Score Actually Do?

**Full sequence (from `triggerAutoScore` at line 133):**

1. **Check universes** — Fetches all active `remarketing_buyer_universes`
2. **Link deal to universes** — Upserts rows into `remarketing_universe_deals`
3. **Assign orphan buyers** — Assigns buyers with `universe_id = null` to primary universe
4. **Import marketplace buyers** — Converts `connection_requests` → `remarketing_buyers`
5. **Queue scoring** — Calls `queueDealScoring()` for each universe (inserts into `remarketing_scoring_queue`)
6. **Fire-and-forget worker** — Invokes `process-scoring-queue` edge function
7. **Google discovery** — Non-blocking, 15-second timeout, discovers new buyers via search
8. **Polling** — Polls `remarketing_scores` count every 4 seconds for up to 3 minutes

### 1.3 Rate Limit Collision Analysis

**The initial hypothesis was wrong.** The system does NOT fire all buyers at once:

- `queueDealScoring()` inserts ONE row per listing into `remarketing_scoring_queue` (not one per buyer)
- `process-scoring-queue` processes items ONE AT A TIME with a 2-second delay between items
- Each queue item calls `score-buyer-deal` in BULK mode, which processes buyers in batches of `BULK_BATCH_SIZE = 5`
- Between batches, there's an adaptive delay: 300ms (≤50 buyers), 400ms (>50), 600ms (>100)
- Rate limit coordination via `checkProviderAvailability()` before each item

**However:** The bulk scoring function (`handleBulkScore`) processes up to 5 buyers in parallel via `Promise.all()`, and each buyer's scoring involves up to 4 parallel AI calls (geography, service, owner goals, thesis). So the actual concurrency can spike to **20 simultaneous Gemini API calls** per batch.

| Metric | Value |
|--------|-------|
| Typical buyer universe size | Variable — depends on deployment |
| AI model used | Gemini (via `GEMINI_API_URL`) for service, owner goals, thesis. Geography uses Gemini for reverse-geocoding in some modes. |
| Gemini rate limit (configured) | 30 RPM soft limit, 10 max concurrent |
| Max concurrent AI calls per batch | 5 buyers × 4 phases = ~20 simultaneous calls |
| 429 handling | **YES** — `checkProviderAvailability()` before processing, `reportRateLimit()` on 429, stops loop and schedules retry |
| What happens on 429 | Queue item set back to `pending`, loop stops, self-continuation scheduled after 60s cooldown |

---

## PHASE 2 — SCORING PIPELINE END-TO-END TRACE

### 2.1 Complete Pipeline Map

```
Step 1: [RecommendedBuyersSection] useEffect detects hasScores === false
  ↓
Step 2: [useAutoScoreDeal] triggerAutoScore() begins
  ↓
Step 3: [triggerAutoScore] Fetches universes, links deal, assigns orphans, imports buyers
  ↓
Step 4: [queueDealScoring()] For each universe: upsert row into remarketing_scoring_queue
  ↓  (via RPC: upsert_deal_scoring_queue — checks for duplicates)
  ↓
Step 5: [queueDealScoring()] Fire-and-forget: supabase.functions.invoke("process-scoring-queue")
  ↓
Step 6: [process-scoring-queue] Acquires advisory lock → fetches next pending item
  ↓
Step 7: [process-scoring-queue] Calls score-buyer-deal (bulk mode) via HTTP POST
  ↓
Step 8: [score-buyer-deal] Fetches listing, universe, all buyers for that universe
  ↓
Step 9: [score-buyer-deal] For each batch of 5 buyers: parallel scoreSingleBuyer()
  ↓
Step 10: [scoreSingleBuyer] Parallel AI calls: geography, service, owner-goals, thesis
  ↓
Step 11: [scoreSingleBuyer] Composite assembly → weighted score → tier assignment
  ↓
Step 12: [score-buyer-deal] Upserts results into remarketing_scores table
  ↓  (also saves immutable score_snapshots)
  ↓
Step 13: [process-scoring-queue] Marks queue item complete, checks for more items
  ↓  (self-continues if items remain, up to 50 continuations)
  ↓
Step 14: [useAutoScoreDeal] Polling detects count > 0 in remarketing_scores
  ↓
Step 15: [RecommendedBuyersSection] useRecommendedBuyers refetches and renders
```

**Failure points:**

| Step | What Can Go Wrong | Error Handling |
|------|-------------------|----------------|
| 5 | Fire-and-forget invocation fails silently | `.catch(err => console.warn(...))` — logged but no retry or user notification |
| 6 | Advisory lock held by prior run | Skips silently — returns `{ processed: 0 }` |
| 7 | HTTP call to score-buyer-deal times out (120s) | Caught, item set back to pending, retry up to 3 attempts |
| 9 | Edge function timeout (140s) | Partial results written, remaining buyers unscored |
| 10 | Gemini 429 rate limit | Detected, reported, loop stopped, retry after 60s |
| 10 | Gemini 402 (credits depleted) | All remaining items force-failed |
| 14 | Polling times out after 3 min | Error state shown: "Scoring timed out. It may still be running in the background" |

### 2.2 Enrichment-Scoring Dependency Check

**FINDING: Scoring and enrichment are COMPLETELY DECOUPLED.**

- The scoring phases (`phases/service.ts`, `phases/geography.ts`, etc.) read whatever data exists on the `remarketing_buyers` record — they never call enrichment.
- The only reference to enrichment in the scoring phases directory is a single comment in `geography.ts:101` about `service_regions` coming from enrichment.
- There is NO code path from scoring that triggers enrichment.
- Score-buyer-deal uses data "as-is" from the database.

**Missing data handling in scoreSingleBuyer (lines 156-209 in score-buyer-deal/index.ts):**

| Condition | What Happens |
|-----------|-------------|
| Buyer has no size data (no revenue/EBITDA targets) | Size weight redistributed to other dimensions |
| Buyer has no geo data | Geography weight redistributed |
| Buyer has no service data | Service weight redistributed |
| Deal has no financials | Size weight redistributed |
| Deal has no location | Geography weight redistributed |
| ALL dimensions lack data | Only `owner_goals_weight` (5%) scores — effectively neutral |

**This is correct behavior.** Buyers are NOT penalized for missing data — their weight is redistributed proportionally.

### 2.3 Database State After Scoring

| Item | Value |
|------|-------|
| Score storage table | `remarketing_scores` |
| Key columns | `listing_id`, `buyer_id`, `universe_id`, `composite_score`, `geography_score`, `size_score`, `service_score`, `owner_goals_score`, `tier`, `status`, `fit_reasoning`, `scored_at`, `deal_snapshot`, `is_disqualified` |
| Status column | `status` — values: `pending`, `approved`, `passed` |
| Partial results on timeout? | **YES** — scores are upserted per-batch, so partial results ARE written |
| `scored_at` timestamp | **YES** — populated with `new Date().toISOString()` (line 358) |
| Immutable audit trail | **YES** — `score_snapshots` table saves every score with metadata |
| Deduplication | Upsert on `(listing_id, buyer_id, universe_id)` unique constraint |
| Status preservation | Existing `approved`/`passed` statuses are preserved on rescore (lines 419-429, 630-648) |

### 2.4 Frontend Polling / Realtime Subscription

| Item | Value |
|------|-------|
| Polling mechanism | `setInterval` every 4 seconds querying `remarketing_scores` count |
| Max poll attempts | 45 (= 3 minutes) |
| Realtime subscription? | **NO** — pure polling |
| What happens on timeout? | Error state: "Scoring timed out. It may still be running in the background — try refreshing." + query invalidation |
| What happens on success? | Status set to `done`, query invalidated, results render |
| Queue status check | Also queries `remarketing_scoring_queue` for `pending`/`processing` items every 3 seconds during scoring |

---

## PHASE 3 — EDGE FUNCTION AUDIT

### 3.1 Function Inventory

| Function Name | Purpose | Timeout | AI Model | Est. Tokens/Call |
|---------------|---------|---------|----------|-----------------|
| `process-scoring-queue` | Queue processor — picks up pending items, calls scoring functions | 140s (MAX_FUNCTION_RUNTIME_MS) | None (orchestrator) | N/A |
| `score-buyer-deal` | Scores one or many buyers against a deal | Edge timeout signal | Gemini | ~2K-5K per buyer (4 AI calls) |
| `score-industry-alignment` | Scores buyer-universe industry fit | Default (60s) | Gemini | ~3K-8K (includes M&A guide) |
| `discover-companies` | Google search for potential buyers | 15s (client-side) | Likely Gemini | ~1K |

### 3.2 Per-Function Deep Audit

#### `process-scoring-queue` (Queue Processor)

| Item | Value |
|------|-------|
| Timeout | 140s (guards via `MAX_FUNCTION_RUNTIME_MS`) |
| Processing mode | **Sequential** — one item at a time |
| Inter-item delay | 2,000ms (`INTER_ITEM_DELAY_MS`) |
| Retry logic | Up to 3 attempts (`MAX_ATTEMPTS`) |
| Dead letter | Items with ≥3 attempts moved to `failed` status |
| Self-continuation | YES — up to 50 continuations to prevent infinite loops |
| Rate limit handling | Checks `checkProviderAvailability('gemini')` before each item. Stops if >30s cooldown. |
| Lock mechanism | `try_acquire_queue_processor_lock` RPC with fallback to check-then-skip |
| Stale recovery | Items in `processing` for >5 min reset to `pending` |
| Global queue integration | Reports progress to `global_activity_queue` |
| Pause support | Checks `isOperationPaused('buyer_scoring')` between items |

#### `score-buyer-deal` (Scoring Engine)

| Item | Value |
|------|-------|
| Timeout | Edge timeout signal (creates abort on platform limit) |
| Processing mode | **Batched parallel** — 5 buyers per batch (`BULK_BATCH_SIZE`) |
| Concurrent AI calls per buyer | 4 (geography, service, owner goals, thesis — all in parallel) |
| Max concurrent AI calls | ~20 per batch (5 buyers × 4 calls) |
| Adaptive delay between batches | 300ms (≤50 buyers), 400ms (>50), 600ms (>100) |
| Already-scored filter | YES — skips buyers with existing scores unless `rescoreExisting` flag |
| Partial results | YES — each batch is upserted independently |
| Deal diagnostics | Logs data quality warnings (missing fields) |
| Buyer readiness stats | Logs coverage percentages for services, geo, size, thesis |

#### `score-industry-alignment` (Alignment Scorer)

| Item | Value |
|------|-------|
| Timeout | Default Supabase edge function limit (~60s) |
| AI model | Gemini (via `DEFAULT_GEMINI_MODEL`) |
| M&A guide dependency | **MANDATORY** — returns `error_code: 'ma_guide_missing'` if no guide |
| 429 handling | Returns 429 with `error_code: 'rate_limited'` |
| 402 handling | Returns 402 with `error_code: 'payment_required'` |
| Temperature | Not explicitly set (Gemini default) |
| Tool calling | YES — uses `score_alignment` function schema |

### 3.3 The Specific Freeze Scenario

**FINDING: The freeze is a Scenario B/C hybrid.**

**What's actually happening:**

1. User opens Buyer Introduction History tab
2. `useRecommendedBuyers` query fires → returns 0 scores → `hasScores = false`
3. `useAutoScoreDeal` triggers → queues scoring → invokes `process-scoring-queue`
4. UI shows "Auto-Scoring Buyers" with progress bar at 65%

**The freeze point is one of these:**

**Scenario B (most likely for initial visits):** The `process-scoring-queue` edge function invocation succeeds but the scoring for a large universe (50+ buyers) takes longer than 3 minutes. The frontend polling (45 × 4s = 180s) times out. The user sees the "Auto-Scoring Buyers" loading state the entire time because:
- The polling loop runs but `remarketing_scores` count stays at 0 until the first batch completes
- With 50 buyers at 5 per batch, 10 batches, ~5s per batch (AI + delays) = ~50 seconds minimum
- If rate limited or if the queue processor lock is contended, it can take much longer

**Scenario C (for repeat visits where prior scoring failed):** If a prior scoring run crashed and left items in `processing` state, the stale recovery only kicks in after 5 minutes. During those 5 minutes, the lock is held, new invocations are skipped, and the frontend sees no progress.

**Scenario D (edge case):** The fire-and-forget invocation of `process-scoring-queue` (line 70-72 in queueScoring.ts) fails silently. The queue has pending items but no processor ever picks them up. The frontend polls for 3 minutes and times out.

**Evidence mapping:**
- The "progress bar at 65%" corresponds to line 328: `progress: 65` is set immediately after queuing
- The "Scoring all buyers, this runs in the background" message is line 329
- The progress is STATIC — it never updates because there's no real-time progress tracking from the queue processor to the frontend
- The progress bar is cosmetic, not reflecting actual completion percentage

---

## PHASE 4 — QUEUE ARCHITECTURE AUDIT

### 4.1 Existing Queue Infrastructure

**The system has THREE queue tables:**

| Queue Table | Purpose | Key Columns |
|-------------|---------|-------------|
| `remarketing_scoring_queue` | Deal and alignment scoring jobs | `universe_id`, `listing_id`, `buyer_id`, `score_type` (deal/alignment), `status`, `attempts`, `last_error`, `processed_at` |
| `enrichment_queue` | Deal enrichment jobs | Standard queue columns |
| `buyer_enrichment_queue` | Buyer enrichment jobs | Standard queue columns |

**Global orchestration table:** `global_activity_queue`
- Tracks major operations across all queue types
- Statuses: `queued`, `running`, `paused`, `completed`, `failed`
- Progress tracking: `total_items`, `completed_items`, `failed_items`
- Error logging: `error_log` JSONB array
- Auto-recovery: stale operations (>10 min) auto-failed
- Drain mechanism: auto-starts next queued operation when current completes

### 4.2 Does Scoring Use the Queue?

**YES — scoring fully uses the queue system.**

1. Frontend calls `queueDealScoring()` → inserts into `remarketing_scoring_queue` → fire-and-forget invoke `process-scoring-queue`
2. `process-scoring-queue` acquires lock → processes ONE item at a time → calls `score-buyer-deal` → marks complete → self-continues
3. The system is NOT synchronous. The frontend returns immediately after queuing.

### 4.3 Queue-Based Scoring Architecture (Current vs. Ideal)

**Current flow (already queue-based):**
```
User opens tab → hasScores check → queue scoring → invoke processor → poll for results
```

**Gaps between current and ideal:**

| Aspect | Current | Ideal |
|--------|---------|-------|
| Progress tracking | Frontend polls `remarketing_scores` count (binary: 0 or >0) | Supabase realtime subscription on `remarketing_scores` for progressive display |
| Progress display | Static cosmetic progress bar (jumps to 65%) | Real progress: "5 of 50 buyers scored" using `global_activity_queue` counters |
| Stale score check | Only checks if ANY scores exist (count > 0) | Should check `scored_at` timestamp — rescore if >24 hours old |
| Worker invocation resilience | Fire-and-forget, single attempt | Should verify processor started via `global_activity_queue` status check |
| Cron backup | No cron — relies on HTTP invocation | Add cron trigger every 60s for `process-scoring-queue` |

### 4.4 Concurrency Limit Analysis

| Provider | Configured Max Concurrent | Configured Soft RPM | Safe Concurrent Scoring Calls | Notes |
|----------|--------------------------|--------------------|-----------------------------|-------|
| Gemini | 10 | 30 | 5 per batch (current) | 5 buyers × 4 phases = 20 calls, but phases run fast |
| Firecrawl | 5 | 20 | N/A (not used in scoring) | Used in enrichment only |
| Apify | 3 | 10 | N/A | Used in enrichment only |

**Current queue processor settings:**
- Batch size: 1 queue item at a time
- Within each item: 5 buyers per batch (`BULK_BATCH_SIZE`)
- Inter-item delay: 2,000ms
- Self-continuation: up to 50 times
- Rate limit backoff: 60s

**These settings are reasonable.** The main risk is the 5-buyer batch creating 20 concurrent Gemini calls, which could exceed the 10 maxConcurrent limit in the rate limiter. However, the rate limiter's `checkProviderAvailability()` is checked at the queue processor level (before invoking score-buyer-deal), not at the individual AI call level within score-buyer-deal.

---

## PHASE 5 — ENRICHMENT-SCORING COUPLING AUDIT

### 5.1 Is Enrichment Triggered by Scoring?

**NO.** Scoring and enrichment are completely separate systems:
- `score-buyer-deal` reads from `remarketing_buyers` and `listings` — never calls enrichment
- No scoring phase imports or references enrichment functions
- The only connection is that both use Gemini AI, coordinated via the shared rate limiter

### 5.2 Enrichment Status

Enrichment status is tracked per-buyer via:
- `extraction_sources` JSON column on `remarketing_buyers`
- `data_last_updated` timestamp
- `buyer_enrichment_queue` for background processing

The scoring system's weight redistribution mechanism (Phase 2.2) correctly handles un-enriched buyers by redistributing missing dimension weights.

### 5.3 Coupling Assessment

**PASS — No coupling found.** The prior suspicion that enrichment was blocking scoring is incorrect. The systems are independent.

---

## PHASE 6 — SCORING ALGORITHM AUDIT

### 6.1 Scoring Dimensions

| Dimension | Default Weight | How Calculated | AI Model | Notes |
|-----------|---------------|----------------|----------|-------|
| Size (EBITDA/Revenue) | 30% | Rule-based — sweet spot matching, range checks | None | Deterministic, no AI |
| Geography | 20% | Rule-based + Gemini for edge cases | Gemini (some modes) | Mode factor adjusts weight (critical/preferred/minimal) |
| Services/Industry | 45% | Keyword + AI semantic matching | Gemini | Hybrid mode with adjacency map fallback |
| Owner Goals | 5% | AI analysis of buyer-deal alignment | Gemini | Considers seller motivation, transition preferences |
| Thesis Alignment | Bonus (up to +20pts) | AI comparison of buyer thesis vs deal | Gemini | Not weighted — additive bonus |
| Data Quality | Bonus (up to +10pts) | Rule-based — counts available data fields | None | Rewards enriched buyers |
| Learning | Penalty (up to -25pts) | Based on historical approve/pass patterns | None | Reduces score for repeatedly-passed buyers |
| Custom Instructions | Bonus/penalty (±25pts) | From `deal_scoring_adjustments` table | None | Manual human overrides |

**Total base weights: 30 + 20 + 45 + 5 = 100%** ✓

### 6.2 Missing Data Handling

| Dimension | Buyer Has No Data | Score Behavior | Correct? |
|-----------|-------------------|----------------|----------|
| Size | No revenue/EBITDA targets | Weight (30%) redistributed to other dimensions | ✓ YES |
| Geography | No geo data | Weight (20%) redistributed | ✓ YES |
| Services | No target services | Weight (45%) redistributed | ✓ YES |
| Owner Goals | No thesis/motivation | Still scored by AI with available data | ✓ YES |
| Thesis | No thesis summary | Bonus = 0 (no penalty) | ✓ YES |

**The system correctly handles missing data.** Weight redistribution preserves the relative importance of scored dimensions.

### 6.3 Score Consistency

| Item | Value |
|------|-------|
| Deterministic? | **Partially** — Size scoring is deterministic. AI-scored dimensions (service, owner goals, thesis) have inherent non-determinism |
| Temperature set to 0? | **NOT EXPLICITLY** — Gemini calls in service.ts, owner-goals.ts, and thesis.ts don't set temperature. This is a finding. |
| Caching? | No score caching. `staleTime: 4h` on the frontend query prevents re-fetching but doesn't prevent re-scoring |
| Same inputs = same output? | Not guaranteed due to AI non-determinism |

**FINDING: Temperature should be set to 0 on all scoring AI calls for consistency.**

### 6.4 Industry Strictness Rules

The `score-industry-alignment` function (lines 128-148) explicitly enforces:
- ✓ "Company names and keywords can be MISLEADING" — addressed in system prompt
- ✓ "Equipment suppliers...are NOT the same as service providers" — addressed in system prompt
- ✓ "Distinguish between companies that PROVIDE services...vs companies that USE or PURCHASE" — addressed
- ✓ Strict scoring scale with explicit range descriptions

The `DEFAULT_SERVICE_ADJACENCY` map (config.ts, lines 74-108) correctly distinguishes:
- ✓ "fire restoration" includes "water restoration" but NOT generic "restoration"
- ✓ Separate entries for commercial vs residential HVAC
- ✓ Collision repair separated from generic automotive

### 6.5 Geography Scoring

The geography phase supports three modes via `IndustryTracker.geography_mode`:
- **critical** — Geography is a hard requirement (mode factor = 1.0)
- **preferred** — Geography matters but not a dealbreaker (mode factor = 0.6)
- **minimal** — Geography barely matters (mode factor = 0.25)

The mode factor adjusts the geography weight in the composite formula, making it industry-aware. This is the correct approach.

---

## PHASE 7 — UI / DISPLAY AUDIT

### 7.1 Loading State Management

| Item | Finding |
|------|---------|
| Loading state variables | `AutoScoreStatus` enum: idle, checking, assigning_universes, importing_buyers, discovering, queuing, scoring, done, error, no_universes |
| Can loading get stuck? | **YES** — If the polling loop times out, the error state is shown. But if `queueStatus` query (line 66-79) keeps returning pending items, the component can re-enter `scoring` state even after the polling timeout. |
| Frontend timeout | YES — 3 minutes (45 polls × 4s). Shows "Scoring timed out" with "try refreshing" message |
| Progress bar accuracy | **FAKE** — Jumps to 5%, 15%, 25%, 30%, 35%, 50%, 65%. Never updates from actual scoring progress. |

### 7.2 Results Display

| Item | Finding |
|------|---------|
| Results query | `useRecommendedBuyers` — queries `remarketing_scores` + buyer profiles + engagement data |
| Null/failed score filtering | YES — filters `is_disqualified.eq.false,is_disqualified.is.null` |
| Sort order | Composite score descending, then fee agreement, then transcript count |
| Minimum score threshold | No minimum — all non-disqualified buyers are shown |
| Empty state message | "No scored buyers for this deal yet" with "Scoring may still be running in the background" — this is appropriate |

### 7.3 Real-time Updates

| Item | Finding |
|------|---------|
| Progressive display? | **NO** — UI waits for polling to detect count > 0, then fetches all results at once |
| Supabase realtime? | **NOT USED** for scoring results |
| First result delay | Must wait for first batch of 5 buyers to complete (~5-10 seconds) before polling detects any scores |

### 7.4 Error States

| Item | Finding |
|------|---------|
| Scoring fails entirely | Shows "Auto-scoring failed: [message]" with "Score Manually" button |
| Retry button? | **NO direct retry** — only "Score Manually" which navigates to a different page |
| No universes | "No buyer universes configured yet" with link to universes page |
| Polling timeout | "Scoring timed out. It may still be running in the background — try refreshing." |

### 7.5 The "No buyer history" Card

The `DealBuyerHistoryTab` component is a **separate component** from `RecommendedBuyersSection`. It shows deal pipeline history (deals table), not scoring results. The "No buyer history for this deal yet" message at `DealBuyerHistoryTab.tsx:153` is correct — it means no deals have been created for this listing, which is independent of scoring.

In the Buyer Introduction History tab (at `index.tsx:167-179`), THREE components render:
1. `RecommendedBuyersSection` — scoring/recommendations (can show "Auto-Scoring" loading)
2. `DealBuyerHistoryTab` — pipeline history (can show "No buyer history")
3. `BuyerIntroductionTracker` — introduction workflow

The user sees BOTH the scoring loading state AND the "No buyer history" card simultaneously because they're independent components stacked vertically. This is confusing but not a bug.

---

## PHASE 8 — PRIORITY FIX LIST

| # | Problem | Root Cause | Fix | Effort | Priority |
|---|---------|-----------|-----|--------|----------|
| 1 | Progress bar is cosmetic/fake | Frontend doesn't read actual scoring progress | Connect to `global_activity_queue` or poll `remarketing_scoring_queue` completion count | Medium | P0 |
| 2 | No real progress feedback | Frontend only checks binary "any scores exist?" | Poll `remarketing_scores` count and show "X of Y buyers scored" | Small | P0 |
| 3 | Fire-and-forget worker can fail silently | `process-scoring-queue` invocation failure is only console.warned | Add verification: after 10s, check if queue items moved from `pending`. If not, re-invoke. | Small | P0 |
| 4 | No retry button when scoring times out | User sees "try refreshing" but no button to retry scoring | Add "Retry Scoring" button in timeout state that re-triggers `triggerAutoScore` | Small | P1 |
| 5 | Stale lock blocks new scoring for 5 min | `STALE_PROCESSING_MINUTES = 5` before stale items are recovered | Reduce to 2 minutes, or add a "force retry" mechanism | Small | P1 |
| 6 | Temperature not set on AI scoring calls | Service, owner goals, thesis AI calls don't set temperature=0 | Set `temperature: 0` on all scoring Gemini calls | Small | P1 |
| 7 | No cron backup for queue processor | Relies solely on HTTP invocation to start processing | Add pg_cron or Supabase cron to invoke `process-scoring-queue` every 60s | Medium | P1 |
| 8 | 20 concurrent Gemini calls per batch | 5 buyers × 4 AI phases = 20 simultaneous calls | Add per-call rate limiter in scoring phases, or reduce batch size to 3 | Small | P2 |
| 9 | Confusing UX: scoring + "no buyer history" | Two independent components show conflicting messages simultaneously | Hide `DealBuyerHistoryTab` while auto-scoring is in progress, or add explanatory text | Small | P2 |
| 10 | TrackerQueryChat conversation not persisted | `TrackerQueryChat` stores messages in component state only | Integrate `chat-persistence.ts` (already exists) into TrackerQueryChat | Medium | P2 |
| 11 | BuyerNarrativePanel has no timeout on stream | SSE stream from ai-command-center has no frontend timeout | Add 30-second timeout on the streaming fetch, show error + retry on timeout | Small | P2 |

---

## PHASE 9 — COMPLETE FIX SPECIFICATION

### Fix 1: Real Progress Tracking (P0)

**Current behavior:** Progress bar shows static 65% while scoring runs. User has no idea how many buyers are scored.

**Target behavior:** Show "Scoring buyers: 15 of 50 complete" with a real progress bar that updates as each batch completes.

**Implementation:**

1. **Frontend polling enhancement** — Instead of polling `remarketing_scores` for count > 0, also poll for total count and compare against expected total:

**File:** `src/hooks/admin/use-auto-score-deal.ts`
```
In the polling interval (line 85-113):
- Also query remarketing_scoring_queue for the current item's status
- Read global_activity_queue for buyer_scoring operation progress
- Update progress: (completed_items / total_items) * 100
- Display: "Scored {completed} of {total} buyers"
```

2. **Frontend component enhancement** — Show incremental count:

**File:** `src/components/remarketing/deal-detail/RecommendedBuyersSection.tsx`
```
In the auto-scoring display block (lines 159-191):
- Show actual count from polling: "15 of 50 buyers scored"
- Use real progress percentage instead of static values
```

### Fix 2: Worker Invocation Resilience (P0)

**Current behavior:** `supabase.functions.invoke("process-scoring-queue")` is fire-and-forget. If it fails, nothing happens.

**Target behavior:** Verify the processor started within 10 seconds. If not, retry invocation.

**File:** `src/hooks/admin/use-auto-score-deal.ts` (after line 308)
```
After queueDealScoring():
- Wait 10 seconds
- Check remarketing_scoring_queue for items still in 'pending' status
- If all items still pending (processor never started):
  - Re-invoke process-scoring-queue
  - Log warning
```

### Fix 3: Retry Button on Timeout (P1)

**Current behavior:** On timeout, user sees "try refreshing" text with a "Score Manually" button that navigates away.

**Target behavior:** Show a "Retry Scoring" button that re-triggers the auto-score.

**File:** `src/components/remarketing/deal-detail/RecommendedBuyersSection.tsx` (lines 194-210)
**File:** `src/hooks/admin/use-auto-score-deal.ts`
```
- Add a resetAndRetry() function that resets triggeredRef and state
- In the error state UI, add a "Retry Scoring" button that calls resetAndRetry()
```

### Fix 4: Set Temperature=0 on Scoring AI Calls (P1)

**Files to change:**
- `supabase/functions/score-buyer-deal/phases/service.ts` — add `temperature: 0` to Gemini call
- `supabase/functions/score-buyer-deal/phases/owner-goals.ts` — add `temperature: 0` to Gemini call
- `supabase/functions/score-buyer-deal/phases/thesis.ts` — add `temperature: 0` to Gemini call
- `supabase/functions/score-industry-alignment/index.ts` — add `temperature: 0` to Gemini call

### Fix 5: Reduce Stale Processing Timeout (P1)

**File:** `supabase/functions/process-scoring-queue/index.ts`
```
Change: const STALE_PROCESSING_MINUTES = 5;
To:     const STALE_PROCESSING_MINUTES = 2;
```

### Fix 6: Add Cron Backup for Queue Processor (P1)

**New migration or Supabase dashboard configuration:**
```sql
-- Add pg_cron job to invoke process-scoring-queue every 60 seconds
SELECT cron.schedule(
  'process-scoring-queue-cron',
  '* * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/process-scoring-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'apikey', current_setting('app.anon_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"trigger": "cron"}'::jsonb
  )$$
);
```

### Fix 7: Reduce Concurrent AI Calls (P2)

**File:** `supabase/functions/score-buyer-deal/config.ts`
```
Change: BULK_BATCH_SIZE: 5,
To:     BULK_BATCH_SIZE: 3,
```

This reduces max concurrent Gemini calls from 20 (5×4) to 12 (3×4), well within the 30 RPM soft limit.

### Fix 8: Hide Confusing "No buyer history" During Scoring (P2)

**File:** `src/pages/admin/remarketing/ReMarketingDealDetail/index.tsx` (lines 167-179)
```
Pass autoScoring state to DealBuyerHistoryTab, or conditionally render it
only when auto-scoring is not in progress.
```

### Fix 9: Add Frontend Timeout on BuyerNarrativePanel Stream (P2)

**File:** `src/components/admin/pipeline/tabs/recommended-buyers/BuyerNarrativePanel.tsx`
```
Add AbortController with 30-second timeout to the fetch call (line 42-57).
On timeout, fall back to client-side narrative generation.
```

---

## PHASE 10 — BUYER RECOMMENDATION FEATURE AUDIT

### 10.1 Component Architecture

**Chat interfaces identified:**

1. **TrackerQueryChat** (`src/components/ma-intelligence/TrackerQueryChat.tsx`)
   - Rendered in the MA Intelligence / buyer universe pages
   - Calls `query-tracker-universe` edge function
   - NOT used in the deal detail / Buyer Introduction History tab
   - Conversation stored in **component state only** — lost on navigation

2. **BuyerNarrativePanel** (`src/components/admin/pipeline/tabs/recommended-buyers/BuyerNarrativePanel.tsx`)
   - Rendered inside `RecommendedBuyersSection` on the Buyer Introduction History tab
   - Calls `ai-command-center` edge function with `generate_buyer_narrative` tool
   - Uses SSE streaming
   - Narrative stored in **component state only** — lost on navigation
   - Has client-side fallback narrative generation

3. **AI Command Center** (global panel)
   - Uses `recommended-buyer-tools.ts` for `get_recommended_buyers` and `generate_buyer_narrative`
   - Has conversation persistence via `chat-persistence.ts` → `chat_conversations` table

**Sidebar buyer highlighting:** The `TrackerQueryChat` has a basic buyer name highlighter using regex pattern matching (line 53-94). It highlights capitalized words followed by entity suffixes (Inc, LLC, Corp, etc.). This is **NOT** connected to buyer IDs — clicking shows a toast, not a buyer profile.

### 10.2 Edge Functions for Recommendations

**`ai-command-center`** — The main edge function for buyer recommendations:
- Uses Claude (Anthropic API) with tool calling
- Tools include `get_recommended_buyers` and `generate_buyer_narrative`
- SSE streaming for real-time response display
- System prompt constructed dynamically

**`query-tracker-universe`** — For TrackerQueryChat:
- Called via `supabase.functions.invoke()` (not streaming)
- Returns complete response, then client simulates streaming with 30ms word delays (lines 128-134)

### 10.3 Decision Tracking

The `remarketing_scores` table has a `status` column with values:
- `pending` — initial state after scoring
- `approved` — user approved this buyer for the deal
- `passed` — user passed on this buyer

**Status preservation:** When a buyer is rescored, existing `approved`/`passed` statuses are preserved (score-buyer-deal/index.ts lines 419-429, 630-648).

**Learning system:** `phases/learning.ts` uses `buyer_learning_history` table:
- Records approve/pass actions with composite scores
- Computes approval rate, average scores on approved vs passed
- Applies a penalty (up to -25 points) for frequently-passed buyers
- Groups pass reasons by category via `passCategories`

**Decision UI:** The `BuyerIntroductionTracker` component (`src/components/remarketing/deal-detail/BuyerIntroductionTracker.tsx`) provides:
- "Not Yet Introduced" and "Introduced & Passed" tabs
- Status update dialog with: introduction_scheduled, introduced, passed, rejected
- Pass reason tracking
- Expected next step dates

### 10.4 Conversation History

| Component | Persistence | Table | Recovery on Re-visit |
|-----------|-------------|-------|---------------------|
| TrackerQueryChat | **Component state only** | None | **Lost** |
| BuyerNarrativePanel | **Component state only** | None (can save to deal notes) | **Lost** |
| AI Command Center | **Database** | `chat_conversations` | **Preserved** |

**The `chat-persistence.ts` module exists and is fully functional** but is NOT used by TrackerQueryChat or BuyerNarrativePanel. The AI Command Center does use it.

### 10.5 Performance

| Metric | Finding |
|--------|---------|
| BuyerNarrativePanel SSE timeout | **NONE** — no AbortController on the fetch |
| TrackerQueryChat timeout | **NONE** — uses `supabase.functions.invoke()` with no timeout |
| System prompt size | Cannot measure without running the function, but `recommended-buyer-tools.ts` fetches: scores, buyer profiles, universes, transcripts, outreach records, connection requests. For 50+ buyers, this could be substantial. |
| Streaming reconnection | **NONE** — if the SSE stream drops, the user sees whatever content accumulated + the fallback |

### 10.6 Known Issues Verification

| Issue | Status |
|-------|--------|
| System prompt size (86-95KB prior finding) | Cannot confirm from static analysis. The `generate_buyer_narrative` tool in `recommended-buyer-tools.ts` fetches all data per-call. Size depends on buyer count and data richness. |
| SmartleadEmailHistory stub | `SmartleadEmailHistory` exists in `supabase/functions/ai-command-center/tools/smartlead-tools.ts` as an AI tool, NOT a null React component. Not a stub issue. |
| Null stubs in deal detail | **No null stubs found.** All three components in the Buyer Introduction History tab (`RecommendedBuyersSection`, `DealBuyerHistoryTab`, `BuyerIntroductionTracker`) render meaningful content. |
| AI response quality | Cannot test without runtime. The system prompt in `score-industry-alignment` is well-structured with explicit strictness rules. |
| `query-tracker-universe` edge function | **MISSING** — Referenced in `TrackerQueryChat.tsx` line 116 (`supabase.functions.invoke("query-tracker-universe")`). No edge function with this name exists in the `supabase/functions/` directory. TrackerQueryChat will fail on any query. This is a separate system from the Buyer Introduction History tab and not directly related to the freeze. |

### 10.7 Recommendation Feature Fix Specification

**Fix R1: Add streaming timeout to BuyerNarrativePanel**
- **Symptom:** If AI command center hangs, narrative generation shows spinner indefinitely
- **Root cause:** No AbortController on fetch at `BuyerNarrativePanel.tsx:42`
- **Fix:** Add `AbortController` with 30s timeout. On abort, fall back to `generateLocalNarrative()`
- **Files:** `src/components/admin/pipeline/tabs/recommended-buyers/BuyerNarrativePanel.tsx`
- **Verify:** Disconnect network during generation — should fall back to local narrative within 30s

**Fix R2: Persist TrackerQueryChat conversations**
- **Symptom:** Conversation lost when navigating away from MA Intelligence page
- **Root cause:** Messages stored in `useState` only
- **Fix:** Import and use `saveConversation`/`loadConversationsByContext` from `chat-persistence.ts`
- **Files:** `src/components/ma-intelligence/TrackerQueryChat.tsx`
- **Verify:** Send a message, navigate away, return — message should persist

**Fix R3: Buyer name highlighting uses regex, not buyer IDs**
- **Symptom:** Clicking a highlighted buyer name in TrackerQueryChat shows a toast, not the buyer profile
- **Root cause:** Highlighting uses regex pattern matching, not actual buyer IDs from the response
- **Fix:** Pass known buyer names/IDs as props to TrackerQueryChat. Match against known buyers instead of regex. Link to `/admin/buyers/{buyerId}` on click.
- **Files:** `src/components/ma-intelligence/TrackerQueryChat.tsx`
- **Verify:** Click highlighted buyer name → navigates to buyer profile

**Fix R4: BuyerNarrativePanel content not persisted**
- **Symptom:** Generated narrative lost on navigation
- **Root cause:** Stored in component state
- **Fix:** Auto-save narrative to `chat_conversations` table with `context_type: 'deal'` after generation completes. Load on mount if exists.
- **Files:** `src/components/admin/pipeline/tabs/recommended-buyers/BuyerNarrativePanel.tsx`
- **Verify:** Generate narrative, navigate away, return — narrative should be restored

---

## APPENDIX A — FILE REFERENCE

### Core Pipeline Files
| File | Purpose |
|------|---------|
| `src/hooks/admin/use-auto-score-deal.ts` | Auto-scoring trigger hook |
| `src/hooks/admin/use-recommended-buyers.ts` | Recommended buyers data fetching |
| `src/lib/remarketing/queueScoring.ts` | Queue scoring utility |
| `src/components/remarketing/deal-detail/RecommendedBuyersSection.tsx` | Main UI for recommendations |
| `src/pages/admin/remarketing/ReMarketingDealDetail/index.tsx` | Deal detail page layout |

### Edge Functions
| File | Purpose |
|------|---------|
| `supabase/functions/process-scoring-queue/index.ts` | Queue processor |
| `supabase/functions/score-buyer-deal/index.ts` | Scoring orchestration |
| `supabase/functions/score-buyer-deal/config.ts` | Scoring configuration |
| `supabase/functions/score-buyer-deal/types.ts` | Type definitions |
| `supabase/functions/score-buyer-deal/phases/*.ts` | Individual scoring phases |
| `supabase/functions/score-industry-alignment/index.ts` | Industry alignment scorer |

### Shared Infrastructure
| File | Purpose |
|------|---------|
| `supabase/functions/_shared/rate-limiter.ts` | Rate limit coordination |
| `supabase/functions/_shared/global-activity-queue.ts` | Global operation tracking |

### Recommendation Feature
| File | Purpose |
|------|---------|
| `src/components/admin/pipeline/tabs/recommended-buyers/BuyerNarrativePanel.tsx` | AI narrative generation |
| `src/components/admin/pipeline/tabs/recommended-buyers/BuyerRecommendationCard.tsx` | Buyer card display |
| `src/components/ma-intelligence/TrackerQueryChat.tsx` | Chat interface for tracker queries |
| `supabase/functions/ai-command-center/tools/recommended-buyer-tools.ts` | AI tools for recommendations |
| `src/integrations/supabase/chat-persistence.ts` | Conversation storage |

### Database Tables
| Table | Purpose |
|-------|---------|
| `remarketing_scores` | Buyer-deal fit scores |
| `score_snapshots` | Immutable score history |
| `remarketing_scoring_queue` | Scoring job queue |
| `remarketing_buyers` | Buyer profiles |
| `remarketing_buyer_universes` | Buyer universe config |
| `remarketing_universe_deals` | Deal-universe links |
| `global_activity_queue` | Global operation tracking |
| `enrichment_rate_limits` | Rate limit coordination |
| `deal_scoring_adjustments` | Custom scoring overrides |
| `buyer_learning_history` | Approve/pass learning data |
| `chat_conversations` | Conversation persistence |

---

*SourceCo Internal — Buyer Recommendation & Scoring Pipeline Audit Report v2.0 — March 2026*
*Generated by Claude Code audit session*
