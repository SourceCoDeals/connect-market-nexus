

# Deal Enrichment Improvements Plan

## Summary
This plan implements three key improvements to the deal enrichment system:
1. **Show successful/failed counts during enrichment** - Live progress tracking like the buyer universe
2. **Completion summary popup** - Dialog showing results when enrichment finishes
3. **Smart CSV import** - Only enrich newly imported deals, not existing ones

---

## Issues Identified

### Current State
1. **Progress Indicator lacks detail** - The `EnrichmentProgressIndicator` shows completed/total counts but NOT successful vs. failed breakdown during enrichment
2. **No completion summary** - When enrichment finishes, users only see a toast notification; no detailed summary dialog exists for deals (unlike buyers which have `EnrichmentSummaryDialog`)
3. **Auto-enrichment queues ALL unenriched deals** - When new deals are imported, the `useEffect` in `ReMarketingDeals.tsx` queues all deals without `enriched_at`, not just the newly imported ones

---

## Implementation Plan

### Phase 1: Enhance Progress Indicator with Success/Failure Counts

**Modify `useEnrichmentProgress.ts`:**
- Track `successfulCount` and `failedCount` separately (completed = successful, failed stays as failed)
- Already tracks `failedCount` but UI doesn't display it

**Modify `EnrichmentProgressIndicator.tsx`:**
- Add props for `successfulCount` and `failedCount`
- Display success/failure breakdown below the progress bar with colored badges

```text
┌──────────────────────────────────────────────────────────────────┐
│ ⚡ Enriching deals...  (~2.8/min)          35 of 82 complete     │
│ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░   ⏱ ~17 min remaining│
│ 47 deals remaining                                                │
│ ✅ 33 successful  •  ❌ 2 failed                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Phase 2: Create Deal Enrichment Summary Dialog

**Create `DealEnrichmentSummaryDialog.tsx`:**
- Based on existing `EnrichmentSummaryDialog.tsx` pattern but for deals
- Props: open, onOpenChange, summary (total, successful, failed, errors array)
- Display:
  - Summary stats grid (Total, Successful, Failed)
  - Success rate badge
  - Scrollable error list with deal names
  - "Retry Failed" button
  - "Close" button

**Modify `useEnrichmentProgress.ts`:**
- Track errors with deal details (listing_id, title, error message)
- Detect completion transition (was running, now stopped)
- Return `summary` and `showSummary` state
- Add `dismissSummary` callback

**Modify `ReMarketingDeals.tsx`:**
- Import and render `DealEnrichmentSummaryDialog`
- Pass summary from `useEnrichmentProgress`
- Wire up "Retry Failed" to re-queue failed deals

### Phase 3: Smart CSV Import (Only Enrich New Deals)

**Current Problem:**
The `useEffect` in `ReMarketingDeals.tsx` (lines 719-764) queues ALL unenriched deals whenever `listings` changes. This means importing 10 new deals could trigger enrichment for 100+ existing unenriched deals.

**Solution:**
Instead of auto-queuing on listings change, move enrichment to the import completion callback.

**Modify `DealImportDialog.tsx`:**
- After successful imports, return the list of newly created deal IDs
- Pass these IDs to a new callback prop `onImportCompleteWithIds`

**Modify `ReMarketingDeals.tsx`:**
- Remove or disable the auto-enrichment `useEffect` that queues all unenriched deals
- Add handler to queue ONLY the newly imported deal IDs after CSV import
- Keep the "Enrich Deals" button for manual batch enrichment

```typescript
// Updated import callback
const handleImportComplete = async (importedDealIds: string[]) => {
  refetchListings();
  
  if (importedDealIds.length > 0) {
    // Queue only the newly imported deals
    await queueDealsForEnrichment(importedDealIds);
    toast.success(`Queued ${importedDealIds.length} new deals for enrichment`);
  }
};
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/remarketing/DealEnrichmentSummaryDialog.tsx` | Summary dialog for deal enrichment completion |

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useEnrichmentProgress.ts` | Add error tracking, completion detection, summary state |
| `src/components/remarketing/EnrichmentProgressIndicator.tsx` | Add success/failure count display |
| `src/pages/admin/remarketing/ReMarketingDeals.tsx` | Add summary dialog, fix auto-enrichment logic |
| `src/components/remarketing/DealImportDialog.tsx` | Return imported deal IDs for targeted enrichment |
| `src/components/remarketing/index.ts` | Export new dialog component |

---

## Technical Details

### Enhanced Progress Interface
```typescript
interface EnrichmentProgress {
  isEnriching: boolean;
  completedCount: number;    // successfulCount alias
  totalCount: number;
  pendingCount: number;
  processingCount: number;
  failedCount: number;       // Already tracked
  progress: number;
  estimatedTimeRemaining: string;
  processingRate: number;
  // NEW fields
  errors: Array<{ listingId: string; title?: string; error: string }>;
}
```

### Summary Interface (for deals)
```typescript
interface DealEnrichmentSummary {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ 
    listingId: string; 
    dealName?: string; 
    error: string 
  }>;
  completedAt: string;
}
```

### Completion Detection Logic
```typescript
// In useEnrichmentProgress.ts
const wasRunningRef = useRef(false);

// In fetchQueueStatus:
if (wasRunningRef.current && !isEnriching && totalCount > 0) {
  // Generate summary from queue data
  setSummary({ total, successful: completedCount, failed: failedCount, errors, completedAt: new Date().toISOString() });
  setShowSummary(true);
}
wasRunningRef.current = isEnriching;
```

---

## Summary of Changes

1. **Progress with success/failure counts** - Real-time visibility into what's working
2. **Completion summary dialog** - Detailed results with retry option for failed items  
3. **Smart import enrichment** - Only newly imported deals get queued, not the entire backlog

