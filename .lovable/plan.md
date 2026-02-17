

# Fix: Queue-Based Scoring Instead of Fire-All-At-Once

## Problem

When you click "Score All Deals" or trigger scoring across multiple buyers/deals, the frontend fires concurrent edge function calls -- one per deal or buyer -- all at once. Each call hits the Gemini API, causing 429 (RESOURCE_EXHAUSTED) rate limit errors. The edge function logs confirm this: multiple `score-industry-alignment` calls overlap and get rejected.

The enrichment system already solved this problem with a database-backed queue + worker pattern. Scoring needs the same treatment.

## Current Architecture (Broken)

```text
Browser
  |
  |-- for each deal:
  |     invoke('score-buyer-deal', { bulk: true, listingId, universeId })
  |       --> Gemini API (all at once) --> 429 errors
  |
  |-- for each buyer:
  |     invoke('score-industry-alignment', { buyerId, universeId })
  |       --> Gemini API (sequential but client-side, dies on navigation)
```

## Proposed Architecture (Queue-Based)

```text
Browser clicks "Score All"
  |
  +--> Insert rows into `remarketing_scoring_queue` table
  +--> Register operation in Global Activity Queue
  +--> Invoke `process-scoring-queue` worker (fire-and-forget)
  |
  Worker (edge function):
  |-- Pull next item from queue
  |-- Call Gemini API with retry + backoff
  |-- Mark item complete
  |-- Loop until timeout (140s safety)
  |-- Self-invoke if items remain
  |
  Browser polls Global Activity Queue for progress
```

## Technical Changes

### 1. New database table: `remarketing_scoring_queue`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Row ID |
| universe_id | uuid | Which universe |
| buyer_id | uuid (nullable) | For alignment scoring |
| listing_id | uuid (nullable) | For deal scoring |
| score_type | text | 'alignment' or 'deal' |
| status | text | 'pending', 'processing', 'completed', 'failed' |
| attempts | int | Retry count |
| last_error | text | Error message |
| created_at | timestamptz | When queued |
| processed_at | timestamptz | When completed |

### 2. New edge function: `process-scoring-queue`

- Pulls the next pending item from the queue (ordered by created_at)
- Sets status to 'processing'
- Calls the appropriate existing edge function (`score-industry-alignment` or `score-buyer-deal`) internally
- Handles 429 errors with exponential backoff (4s, 8s, 16s)
- Marks item as completed or failed
- Loops until 140s safety threshold
- Self-invokes if queue still has items
- Updates Global Activity Queue progress

### 3. Update frontend "Score All" actions

**File: `src/pages/admin/remarketing/ReMarketingUniverseDetail.tsx`**

Replace the `for` loop that fires concurrent `score-buyer-deal` calls with:
- Insert all items into `remarketing_scoring_queue`
- Register a `buyer_scoring` operation in the Global Activity Queue
- Fire-and-forget invoke of `process-scoring-queue`
- UI shows progress via the existing activity queue polling

**File: `src/hooks/useAlignmentScoring.ts`**

Replace the client-side sequential loop with:
- Insert all unscored buyers into `remarketing_scoring_queue` with type='alignment'
- Register operation in Global Activity Queue
- Fire-and-forget invoke of `process-scoring-queue`
- Progress tracked via DB polling instead of client-side state (survives navigation)

### 4. Integrate with Global Activity Queue

**File: `supabase/functions/_shared/global-activity-queue.ts`**

Add `'buyer_scoring': 'process-scoring-queue'` to the processor map (already partially there). The existing activity status bar and progress UI will automatically pick up scoring operations.

### 5. Other call sites to update

These files also invoke scoring directly and should queue instead:

| File | Current Behavior |
|------|-----------------|
| `AddToUniverseQuickAction.tsx` | Fire-and-forget `score-buyer-deal` |
| `UniverseAssignmentButton.tsx` | Fire-and-forget `score-buyer-deal` |
| `BulkScoringPanel.tsx` | Direct invoke |
| `BulkAssignUniverseDialog.tsx` | Loop of fire-and-forget calls |
| `AddDealToUniverseDialog.tsx` | Loop of fire-and-forget calls |
| `AddBuyerToUniverseDialog.tsx` | Loop of fire-and-forget calls |
| `ReMarketingDealMatching.tsx` | Direct invoke with timeout |

Each of these will be updated to insert into the queue and invoke the worker instead.

## What Does NOT Change

- The `score-buyer-deal` and `score-industry-alignment` edge functions themselves -- they still do the actual AI scoring. The worker calls them internally.
- The scoring algorithms and AI prompts
- The database tables for scores (`remarketing_scores`, `remarketing_buyers.alignment_score`)
- The Global Activity Queue UI components

## Result

- No more 429 rate limit errors from concurrent API calls
- Scoring survives page navigation (queue is in the database)
- Progress visible across all ReMarketing pages via the activity status bar
- Automatic retry with backoff for transient failures
- Consistent with how enrichment already works

