

# Fix: Prevent M&A Guide Generation Timeout Failures

## Problem Summary

The guide generation fails with a "network error" because all 7 batches (13 phases) run inside a **single edge function invocation**. The function correctly checks remaining time before each phase, but the recursive `generateBatch()` call chains batches together, causing cumulative runtime to exceed Supabase's ~150s hard limit.

### Timeline of Failure
```text
Batch 1 (phases 1-2): ~90s  ─┐
Batch 2 (phases 3-4): ~90s   │
Batch 3 (phases 5-6): ~90s   ├── Same HTTP request (~10 min total)
Batch 4 (phases 7-8): ~90s   │
Batch 5 (phase 9): KILLED ──┘ ← Supabase hard timeout hit
```

## Solution: Separate HTTP Requests Per Batch

Move the batch chaining logic to the **frontend** so each batch runs in a **fresh edge function invocation**, resetting the 150s limit each time.

### Current Flow (Broken)
```text
Frontend: fetch(batch 0)
  └─ Edge Function:
       ├─ Generate batch 0
       ├─ SSE: batch_complete, next_batch_index=1
       └─ Stream ends
  ← (Client receives batch_complete)
  → (Client recursively calls generateBatch(1) INSIDE the same SSE handler)
       └─ NEW fetch(batch 1) ← This starts a new request, but...
          ...the old reader loop is still running, creating timing issues
```

### Fixed Flow
```text
Frontend: fetch(batch 0)
  └─ Edge Function: Generate batch 0
       └─ SSE: batch_complete, is_final=false, next_batch_index=1
  ← Stream ends naturally

Frontend: setTimeout → fetch(batch 1)  ← Separate invocation
  └─ Edge Function: Generate batch 1
       └─ SSE: batch_complete, is_final=false, next_batch_index=2
...repeat...

Frontend: fetch(batch 6)
  └─ Edge Function: Generate batch 6
       └─ SSE: batch_complete, is_final=true
       └─ SSE: complete
```

## Implementation

### Step 1: Remove Recursive Call Inside SSE Handler

**File:** `src/components/remarketing/AIResearchSection.tsx`

In the `batch_complete` handler (~lines 529-537), remove the recursive `generateBatch()` call. Instead, store the next batch index and content, then trigger it **after** the current stream fully closes.

```typescript
case 'batch_complete':
  sawBatchComplete = true;
  
  if (batchRetryCountRef.current[batchIndex]) {
    delete batchRetryCountRef.current[batchIndex];
  }
  
  // Store info for next batch (don't call generateBatch here!)
  if (!event.is_final && event.next_batch_index !== null) {
    nextBatchInfo.current = {
      index: event.next_batch_index,
      content: event.content,
      clarificationContext
    };
  }
  break;
```

### Step 2: Chain Batches After Stream Ends

After the `while (true)` reader loop exits, check if there's a next batch to process:

```typescript
// After the reader loop (~line 644)

// If the stream ends without batch_complete, throw timeout error
if (!sawBatchComplete) {
  const timeoutError = new Error(...);
  throw timeoutError;
}

// Chain to next batch OUTSIDE the stream handler
if (nextBatchInfo.current) {
  const { index, content, clarificationContext: ctx } = nextBatchInfo.current;
  nextBatchInfo.current = null;
  
  // Small delay to ensure clean separation
  await new Promise(r => setTimeout(r, 1000));
  toast.info(`Starting batch ${index + 1}...`);
  
  // This now runs AFTER the previous stream fully closed
  await generateBatch(index, content, ctx);
}
```

### Step 3: Add Ref for Next Batch Info

Add a ref to store next batch info:

```typescript
const nextBatchInfo = useRef<{
  index: number;
  content: string;
  clarificationContext: ClarificationContext;
} | null>(null);
```

### Step 4: Reduce Batch Size as Safety Margin

**File:** `supabase/functions/generate-ma-guide/index.ts`

Change line 630:
```typescript
// Before
const BATCH_SIZE = 2;

// After
const BATCH_SIZE = 1;  // Single phase per batch = safer time budget
```

This means 13 batches instead of 7, but each batch completes well within the 150s limit.

## Trade-offs

| Aspect | Before | After |
|--------|--------|-------|
| HTTP requests | 1 (all batches chained) | 13 (one per phase) |
| Timeout risk | High (cumulative time) | Low (resets each request) |
| Total generation time | Same | Same + ~13s delay overhead |
| Progress saved | Per phase | Per phase (unchanged) |
| Resumability | Broken (state lost on timeout) | Works (clean batch boundaries) |

## Files to Modify

1. **`src/components/remarketing/AIResearchSection.tsx`**
   - Add `nextBatchInfo` ref
   - Modify `batch_complete` handler to store (not call) next batch
   - Move batch chaining to after stream closes

2. **`supabase/functions/generate-ma-guide/index.ts`**
   - Change `BATCH_SIZE` from 2 to 1

## Testing

1. Start guide generation for any industry
2. Observe batches completing as separate requests (each batch toast after ~60-90s)
3. Verify all 13 phases complete without timeout
4. Confirm final guide saves to Supporting Documents

