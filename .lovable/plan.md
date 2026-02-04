
# Plan: Add Enrichment Selection Dialog for Buyers

## Summary

The "Enrich All" button on the Universe Buyers tab currently triggers enrichment directly for all buyers with websites. This plan adds a selection dialog (matching the pattern from the All Deals page) that gives users two options:
1. **Enrich All** - Re-enrich all buyers (resets existing data)
2. **Only Unenriched** - Only enrich buyers that haven't been enriched yet

## Current Behavior

When clicking "Enrich All" in the Buyers tab:
- Immediately calls `enrichBuyers()` with all buyers that have websites
- No option to skip already-enriched buyers

## Proposed Changes

### 1. Add State for Enrich Dialog in ReMarketingUniverseDetail.tsx

Add a new state variable to control the dialog visibility:
```tsx
const [showBuyerEnrichDialog, setShowBuyerEnrichDialog] = useState(false);
```

### 2. Update BuyerTableToolbar Button Handler

Change the `onEnrichAll` handler to open the dialog instead of directly enriching:
```tsx
onEnrichAll={() => setShowBuyerEnrichDialog(true)}
```

### 3. Add Enrichment Handler Function

Create a handler that processes the user's selection:
```tsx
const handleBuyerEnrichment = async (mode: 'all' | 'unenriched') => {
  setShowBuyerEnrichDialog(false);
  
  if (!buyers?.length) {
    toast.error('No buyers to enrich');
    return;
  }
  
  resetEnrichment();
  
  // Filter based on mode
  const buyersToEnrich = mode === 'all' 
    ? buyers 
    : buyers.filter(b => b.data_completeness !== 'high');
  
  if (buyersToEnrich.length === 0) {
    toast.info('All buyers are already enriched');
    return;
  }
  
  await enrichBuyers(buyersToEnrich.map(b => ({
    id: b.id,
    company_website: b.company_website,
    platform_website: b.platform_website,
    pe_firm_website: b.pe_firm_website
  })));
};
```

### 4. Add Enrich Buyers Dialog Component

Add the dialog at the bottom of the component (before the closing `</div>`):
```tsx
<Dialog open={showBuyerEnrichDialog} onOpenChange={setShowBuyerEnrichDialog}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Sparkles className="h-5 w-5" />
        Enrich Buyers
      </DialogTitle>
      <DialogDescription>
        Enrichment scrapes websites and extracts company data, 
        investment criteria, and M&A intelligence.
      </DialogDescription>
    </DialogHeader>
    <div className="flex flex-col gap-3 py-4">
      <Button
        variant="default"
        className="w-full justify-start h-auto py-4 px-4"
        onClick={() => handleBuyerEnrichment('all')}
        disabled={enrichmentProgress.isRunning}
      >
        <div className="flex flex-col items-start gap-1">
          <span className="font-medium">Enrich All</span>
          <span className="text-xs text-muted-foreground font-normal">
            Re-enrich all {buyers?.filter(b => 
              b.company_website || b.platform_website || b.pe_firm_website
            ).length || 0} buyers (resets existing data)
          </span>
        </div>
      </Button>
      <Button
        variant="outline"
        className="w-full justify-start h-auto py-4 px-4"
        onClick={() => handleBuyerEnrichment('unenriched')}
        disabled={enrichmentProgress.isRunning}
      >
        <div className="flex flex-col items-start gap-1">
          <span className="font-medium">Only Unenriched</span>
          <span className="text-xs text-muted-foreground font-normal">
            Only enrich {buyers?.filter(b => 
              b.data_completeness !== 'high' && 
              (b.company_website || b.platform_website || b.pe_firm_website)
            ).length || 0} buyers that haven't been enriched yet
          </span>
        </div>
      </Button>
    </div>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setShowBuyerEnrichDialog(false)}>
        Cancel
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 5. Update Imports

Add the Dialog components to the imports:
```tsx
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
```

## Technical Details

| Aspect | Detail |
|--------|--------|
| Enriched Detection | Uses `data_completeness === 'high'` as the enrichment indicator |
| Website Check | Filters by `company_website || platform_website || pe_firm_website` |
| Dialog Pattern | Matches the existing pattern from ReMarketingDeals.tsx |
| Count Display | Shows dynamic counts for both options |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/remarketing/ReMarketingUniverseDetail.tsx` | Add state, handler, dialog, and update imports |
