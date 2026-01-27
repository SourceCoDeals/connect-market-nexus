
# Buyer Enrichment Process Fixes

## Problem Summary
The bulk buyer enrichment process is failing due to three compounding issues:
1. **AI credits are depleted** (402 errors in logs)
2. **Sequential processing** with 500ms delays makes it extremely slow
3. **Errors are silently caught**, giving no user feedback when enrichment fails

---

## Root Cause Analysis

### Why It Disappeared
The enrichment loop catches errors silently and continues, so when AI credits ran out at buyer 67, the remaining 53 buyers silently failed. The dialog may have been accidentally closed or the process completed with hidden failures.

### Performance Bottleneck
```text
┌─────────────────────────────────────────────────────────────┐
│ Current Sequential Architecture                              │
├─────────────────────────────────────────────────────────────┤
│ Buyer 1 → Wait 500ms → Buyer 2 → Wait 500ms → Buyer 3...   │
│                                                              │
│ Per Buyer:                                                   │
│   • Edge function boot: ~40ms                               │
│   • Website scrape 1: ~5-8 seconds                          │
│   • Website scrape 2: ~5-8 seconds                          │
│   • 6 AI extraction calls: ~2-3 seconds each                │
│   • Total: ~20-30 seconds per buyer                         │
│                                                              │
│ 120 buyers × 30 seconds = 60+ minutes!                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Fix 1: Fail-Fast on 402 Errors
**Files:** `src/components/remarketing/BuyerCSVImport.tsx`

Update `triggerBulkEnrichment` to detect billing errors and stop immediately:
- Parse the error response from the edge function
- If error contains "402" or "credits", halt the loop
- Show a clear toast message with link to add credits
- Mark remaining buyers as "needs enrichment" rather than silently failing

### Fix 2: Parallel Batch Processing
**Files:** `src/components/remarketing/BuyerCSVImport.tsx`

Replace sequential loop with concurrent batches:
- Process 5 buyers in parallel using `Promise.allSettled`
- Add 1-second delay between batches (not per buyer)
- Show granular progress: "Batch 3 of 24 (15 buyers enriched)"

### Fix 3: Edge Function 402 Handling
**Files:** `supabase/functions/enrich-buyer/index.ts`

When AI calls return 402:
- Stop making additional AI calls for that buyer
- Return a structured error response with `error_code: 'payment_required'`
- Include which fields were successfully extracted before the error

### Fix 4: Background Enrichment Mode
**Files:** 
- `src/components/remarketing/BuyerCSVImport.tsx`
- `src/pages/admin/remarketing/ReMarketingUniverseDetail.tsx`

Allow enrichment to continue after dialog close:
- Store enrichment progress in component state lifted to parent
- Add "Enrichment in Progress" indicator in the buyer toolbar
- Allow dialog to be reopened to view progress
- Add "Cancel Enrichment" option

### Fix 5: Visual Enrichment Status
**Files:** `src/components/remarketing/BuyerTableEnhanced.tsx`

Add status badges to buyer rows:
- "Pending" - Has website, not yet enriched
- "Enriching..." - Currently being processed
- "Enriched" - Successfully completed
- "Failed" - Error during enrichment (with retry button)

---

## Technical Implementation Details

### Parallel Processing Logic
```typescript
// Process in batches of 5
const BATCH_SIZE = 5;
for (let i = 0; i < buyers.length; i += BATCH_SIZE) {
  const batch = buyers.slice(i, i + BATCH_SIZE);
  
  const results = await Promise.allSettled(
    batch.map(buyer => 
      supabase.functions.invoke('enrich-buyer', { body: { buyerId: buyer.id } })
    )
  );
  
  // Check for 402 in any result
  const creditError = results.find(r => 
    r.status === 'rejected' && r.reason?.message?.includes('402')
  );
  
  if (creditError) {
    toast.error('AI credits depleted. Add credits to continue.');
    break; // Stop processing
  }
  
  await new Promise(r => setTimeout(r, 1000)); // 1s between batches
}
```

### Edge Function Error Response
```typescript
// In enrich-buyer when 402 detected
return new Response(JSON.stringify({
  success: false,
  error: 'AI credits depleted',
  error_code: 'payment_required',
  partial_data: extractedData, // What we got before error
  recoverable: false
}), { status: 402, headers: corsHeaders });
```

---

## Files to Modify

1. **`src/components/remarketing/BuyerCSVImport.tsx`**
   - Parallel batch processing
   - 402 error detection and user messaging
   - Progress state improvements

2. **`supabase/functions/enrich-buyer/index.ts`**
   - Fail-fast on 402 errors
   - Structured error responses with error codes
   - Partial data return on failure

3. **`src/pages/admin/remarketing/ReMarketingUniverseDetail.tsx`**
   - Enrichment state lifted to page level
   - Progress indicator in toolbar
   - Background enrichment support

4. **`src/components/remarketing/BuyerTableEnhanced.tsx`**
   - Enrichment status column/badges
   - Per-row retry button for failed enrichments

---

## Immediate Action Required

**Add credits to your Lovable workspace** before testing any fixes:
- Go to Settings → Workspace → Usage
- The enrichment process was hitting 402 errors because credits were depleted
- All 6 AI extraction prompts per buyer were failing

---

## Expected Improvements

| Metric | Before | After |
|--------|--------|-------|
| 120 buyers enrichment time | 60+ minutes | ~12 minutes |
| Failed enrichment visibility | Silent failure | Clear error toast |
| Credit depletion handling | Continues failing | Stops immediately |
| Dialog close behavior | Lost progress | Continues in background |
| User feedback | Minimal | Real-time status per buyer |
