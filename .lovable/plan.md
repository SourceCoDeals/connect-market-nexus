

## Plan: Add AI Buyer Search Summary Dialog

When the AI buyer search completes, show a summary dialog (similar to the existing `EnrichmentSummaryDialog` and `DealEnrichmentSummaryDialog` patterns) displaying what was found, inserted, updated, and any errors.

### Changes

**1. New component: `src/components/remarketing/BuyerSearchSummaryDialog.tsx`**
- Follows the same pattern as `EnrichmentSummaryDialog.tsx`
- Shows: Total found, New inserted, Existing enriched, Probable duplicates
- Shows each buyer with its action badge (inserted/enriched/duplicate/cached)
- Shows the buyer profile summary if available
- Shows whether results were cached
- Icon: `Sparkles` (matching the AI Search button)

**2. Update `RecommendedBuyersTab.tsx`**
- Add state: `showSearchSummary` (boolean) and `searchSummaryData` (to hold the `SeedBuyersResponse`)
- In `handleSeedBuyers`, after successful completion, set the summary data and open the dialog
- On error, also capture it so the dialog can show the failure
- Render `BuyerSearchSummaryDialog` at the bottom of the component
- Remove the toast notifications (replaced by the dialog)

### Summary Dialog Content
- Header: "AI Buyer Search Complete" with Sparkles icon
- Stats grid: Total | New | Updated | Duplicates
- Cached indicator badge if results came from cache
- Scrollable list of all found buyers with action badges and relevance reasons
- "Close" button, plus "Search Again" if cached results were shown

