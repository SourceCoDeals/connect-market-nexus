
# Add Progress Feedback for Single Deal Enrichment

## Problem

When clicking the "Enrich" button on the Deal Transcript section, there's no visual feedback about:
- What's happening during enrichment (progress indicator)
- What was extracted when complete (success details)
- What went wrong if it failed (error details)

## Solution

Create a **single-deal enrichment progress** experience that shows:
1. An animated progress card while enriching
2. A completion dialog with detailed results (fields updated, errors, scrape report)

## Implementation

### 1. Create `SingleDealEnrichmentResult` interface

Define a type for the enrichment response:
```typescript
interface SingleDealEnrichmentResult {
  success: boolean;
  message?: string;
  fieldsUpdated?: string[];
  error?: string;
  extracted?: Record<string, unknown>;
  scrapeReport?: {
    totalPagesAttempted: number;
    successfulPages: number;
    totalCharactersScraped: number;
    pages: Array<{ url: string; success: boolean; chars: number }>;
  };
}
```

### 2. Create `SingleDealEnrichmentDialog` component

**File:** `src/components/remarketing/SingleDealEnrichmentDialog.tsx`

A dialog that shows:
- Success/failure status with icon
- List of fields that were updated (with friendly names)
- Scrape report (how many pages were scraped)
- Error message if failed
- Close button

### 3. Update `DealTranscriptSection.tsx`

Modify the enrichment handler to:
1. Show an inline progress indicator (reuse `EnrichmentProgressIndicator` pattern)
2. Capture the full response from the edge function
3. Open the summary dialog when complete

Changes:
- Add `enrichmentResult` state to store the response
- Add `showEnrichmentDialog` state
- Update `handleEnrichDeal` to capture and store the result
- Render progress indicator when `isEnriching` is true
- Render summary dialog when `showEnrichmentDialog` is true

### 4. Progress Indicator Design

Since this is a single-deal operation (not batch), use a simpler indicator:
- Show "Enriching deal..." with animated spinner
- Show stages: "Scraping website...", "Extracting data...", "Saving..."
- Use existing `Card` + `Progress` components for consistency

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/remarketing/SingleDealEnrichmentDialog.tsx` | Create - summary dialog |
| `src/components/remarketing/DealTranscriptSection.tsx` | Modify - add progress + dialog |

## UI Preview

**During enrichment:**
```
┌─────────────────────────────────────────────────────────────┐
│ ⚡ Enriching deal...                                        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (indeterminate)     │
│ Scraping website and extracting intelligence               │
└─────────────────────────────────────────────────────────────┘
```

**On completion (success):**
```
┌─────────────────────────────────────────────────────────────┐
│ ✓ Enrichment Complete                                       │
├─────────────────────────────────────────────────────────────┤
│ Updated 8 fields:                                           │
│  • Executive Summary                                        │
│  • Business Model                                           │
│  • Geographic States (TX, OK, AR)                          │
│  • Industry                                                 │
│  • Services                                                 │
│  • Customer Types                                           │
│  • Address (Dallas, TX)                                     │
│  • Founded Year                                             │
├─────────────────────────────────────────────────────────────┤
│ Scraped 3 of 5 pages (12,450 characters)                   │
├─────────────────────────────────────────────────────────────┤
│                                              [Close]        │
└─────────────────────────────────────────────────────────────┘
```

**On failure:**
```
┌─────────────────────────────────────────────────────────────┐
│ ✗ Enrichment Failed                                         │
├─────────────────────────────────────────────────────────────┤
│ Error: No website URL found for this deal.                  │
│ Add a website in the company overview or deal memo.         │
├─────────────────────────────────────────────────────────────┤
│                                     [Retry]    [Close]      │
└─────────────────────────────────────────────────────────────┘
```

## Technical Notes

- The `enrich-deal` function already returns detailed response data including `fieldsUpdated`, `extracted`, and `scrapeReport`
- We'll create a mapping of field names to human-readable labels (e.g., `executive_summary` → "Executive Summary")
- The progress indicator will be indeterminate since we can't track stages in a single API call
- Reuses existing UI components: `Dialog`, `Card`, `Progress`, `Badge`, `ScrollArea`
