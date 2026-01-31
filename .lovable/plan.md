
# Fix: Auto-Retry Rate-Limited Batches + Inter-Phase Delays

## Problem Summary

The AI Guide generation stopped at Phase 1b due to a 429 "RESOURCE_EXHAUSTED" rate limit from Gemini. The system has two issues:

1. **Backend**: No delay between phases - batches fire API calls back-to-back, hitting Gemini's rate limits
2. **Frontend**: Rate limit errors are detected but not auto-retried - the generation fails instead of waiting and retrying

---

## Solution Overview

| Component | Issue | Fix |
|-----------|-------|-----|
| Backend (`generate-ma-guide`) | No inter-phase delays | Add 2-second delay between phases |
| Frontend (`AIResearchSection`) | Rate limit errors fail immediately | Auto-retry after 30s backoff |
| Frontend | MAX_BATCH_RETRIES = 2 | Increase to 3 for rate limit resilience |

---

## Implementation Details

### Part 1: Backend - Add Inter-Phase Delays

**File: `supabase/functions/generate-ma-guide/index.ts`**

Add a delay constant and insert delays between phase generations:

```typescript
// At line ~617 (after BATCH_SIZE constant)
const INTER_PHASE_DELAY_MS = 2000; // 2 seconds between API calls

// In the batch loop (around line 1074), add delay BEFORE each phase except the first:
for (let i = 0; i < batchPhases.length; i++) {
  const phase = batchPhases[i];
  
  // Add delay between phases to prevent rate limiting
  if (i > 0) {
    send({ type: 'heartbeat', message: 'Cooling down before next phase...' });
    await new Promise(r => setTimeout(r, INTER_PHASE_DELAY_MS));
  }
  
  // ... rest of phase generation
}
```

This proactively prevents rate limits by spacing out API calls.

---

### Part 2: Frontend - Auto-Retry Rate-Limited Batches

**File: `src/components/remarketing/AIResearchSection.tsx`**

**Change 1: Increase retry budget (line 96)**
```typescript
// Change from 2 to 3
const MAX_BATCH_RETRIES = 3;
```

**Change 2: Modify the rate limit handling in SSE event parser (lines 465-470)**

Currently the code waits 30 seconds then throws, which fails the generation. Instead, it should let the error bubble up to the catch block which handles auto-retry.

```typescript
// BEFORE (lines 465-470):
if (event.error_code === 'rate_limited') {
  toast.warning("Rate limit reached. Waiting 30 seconds before retrying...");
  await new Promise(r => setTimeout(r, 30000));
  // Continue to throw so auto-retry kicks in
}
throw new Error(event.message);

// AFTER:
if (event.error_code === 'rate_limited') {
  // Throw with rate limit flag so catch block handles retry with backoff
  const err = new Error(event.message);
  (err as any).isRateLimited = true;
  throw err;
}
throw new Error(event.message);
```

**Change 3: Update the catch block to handle rate limits (lines 497-512)**

```typescript
// BEFORE:
const isStreamCutoff = message.includes('Stream ended unexpectedly during batch');
const currentRetries = batchRetryCountRef.current[batchIndex] ?? 0;
if (state === 'generating' && isStreamCutoff && currentRetries < MAX_BATCH_RETRIES) {
  // ... retry logic
}

// AFTER:
const isStreamCutoff = message.includes('Stream ended unexpectedly during batch');
const isRateLimited = 
  (error as any).isRateLimited || 
  message.includes('Rate limit') ||
  message.includes('rate_limited') ||
  message.includes('RESOURCE_EXHAUSTED');

const currentRetries = batchRetryCountRef.current[batchIndex] ?? 0;
if (state === 'generating' && (isStreamCutoff || isRateLimited) && currentRetries < MAX_BATCH_RETRIES) {
  batchRetryCountRef.current[batchIndex] = currentRetries + 1;
  
  // Use longer backoff for rate limits (30s) vs stream cutoffs (1-3s)
  const backoffMs = isRateLimited ? 30000 : 1000 * (currentRetries + 1);
  
  toast.info(
    isRateLimited
      ? `Rate limit hit. Waiting 30s before retry (${currentRetries + 1}/${MAX_BATCH_RETRIES})...`
      : `Connection dropped during batch ${batchIndex + 1}. Retrying (${currentRetries + 1}/${MAX_BATCH_RETRIES})...`
  );
  
  await new Promise((r) => setTimeout(r, backoffMs));
  abortControllerRef.current = new AbortController();
  await generateBatch(batchIndex, previousContent, clarificationContext);
  return;
}
```

---

## Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `supabase/functions/generate-ma-guide/index.ts` | ~617 | Add `INTER_PHASE_DELAY_MS = 2000` constant |
| `supabase/functions/generate-ma-guide/index.ts` | ~1074 | Add delay before each phase (except first) |
| `src/components/remarketing/AIResearchSection.tsx` | 96 | Increase `MAX_BATCH_RETRIES` to 3 |
| `src/components/remarketing/AIResearchSection.tsx` | 465-470 | Throw with `isRateLimited` flag instead of waiting inline |
| `src/components/remarketing/AIResearchSection.tsx` | 497-512 | Add rate limit detection to auto-retry logic |

---

## Expected Behavior After Fix

1. **Proactive Prevention**: 2-second delays between phases reduce likelihood of hitting rate limits
2. **Graceful Recovery**: If a rate limit does occur:
   - User sees: "Rate limit hit. Waiting 30s before retry (1/3)..."
   - System waits 30 seconds automatically
   - Batch retries from where it left off
   - Up to 3 retry attempts before failing
3. **Seamless Experience**: Users don't need to manually resume - the generation continues automatically
