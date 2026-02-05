
## Fix Buyer Table Actions - Row Dropdown + Bulk Delete

### Problem Summary

On the Buyer Universe detail page, the buyer table has non-functional row-level actions:
1. **Row dropdown menu is empty** - The three-dot menu on each buyer row shows no options because the required `onEnrich` and `onDelete` props are not passed to `BuyerTableEnhanced`
2. **No bulk delete option** - Users can select multiple buyers but can only "Remove from Universe" (unlink), not permanently delete them

### Solution

#### 1. Add Missing Props to BuyerTableEnhanced Usage

Pass `onEnrich` and `onDelete` handlers to the `BuyerTableEnhanced` component in `ReMarketingUniverseDetail.tsx`:

```text
File: src/pages/admin/remarketing/ReMarketingUniverseDetail.tsx

Current (lines 748-754):
  <BuyerTableEnhanced
    buyers={filteredBuyers}
    showPEColumn={true}
    buyerIdsWithTranscripts={buyerIdsWithTranscripts}
    selectable={true}
    onRemoveFromUniverse={handleRemoveBuyersFromUniverse}
  />

Change to:
  <BuyerTableEnhanced
    buyers={filteredBuyers}
    showPEColumn={true}
    buyerIdsWithTranscripts={buyerIdsWithTranscripts}
    selectable={true}
    onRemoveFromUniverse={handleRemoveBuyersFromUniverse}
    onEnrich={handleEnrichSingleBuyer}
    onDelete={handleDeleteBuyer}
  />
```

#### 2. Add Handler Functions

Create the missing handler functions in `ReMarketingUniverseDetail.tsx`:

```text
// Single buyer enrichment handler
const handleEnrichSingleBuyer = async (buyerId: string) => {
  await queueBuyers([{ id: buyerId }]);
};

// Single buyer delete handler (with cascade)
const handleDeleteBuyer = async (buyerId: string) => {
  if (!confirm('Are you sure you want to permanently delete this buyer?')) return;
  
  const { error } = await deleteBuyerWithRelated(buyerId);
  if (error) {
    toast.error('Failed to delete buyer');
    return;
  }
  
  toast.success('Buyer deleted');
  queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers', id] });
};
```

#### 3. Add Bulk Delete to BuyerTableEnhanced

Update `BuyerTableEnhanced.tsx` to include a bulk delete button alongside "Remove from Universe":

```text
File: src/components/remarketing/BuyerTableEnhanced.tsx

Add new prop:
  onBulkDelete?: (buyerIds: string[]) => Promise<void>;

Add delete button next to Remove from Universe button (in bulk action bar):
  <Button
    size="sm"
    variant="destructive"
    onClick={handleBulkDelete}
    disabled={isDeleting}
  >
    <Trash2 className="h-4 w-4 mr-1" />
    Delete {selectedIds.size} Permanently
  </Button>
```

#### 4. Add Bulk Delete Handler to Universe Detail Page

```text
File: src/pages/admin/remarketing/ReMarketingUniverseDetail.tsx

const handleBulkDeleteBuyers = async (buyerIds: string[]) => {
  for (const buyerId of buyerIds) {
    await deleteBuyerWithRelated(buyerId);
  }
  toast.success(`Deleted ${buyerIds.length} buyers`);
  queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers', id] });
};

// Pass to BuyerTableEnhanced:
onBulkDelete={handleBulkDeleteBuyers}
```

### Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/remarketing/ReMarketingUniverseDetail.tsx` | Add `onEnrich`, `onDelete`, `onBulkDelete` handlers and pass to table |
| `src/components/remarketing/BuyerTableEnhanced.tsx` | Add `onBulkDelete` prop and bulk delete button in action bar |

### Technical Details

- Uses existing `deleteBuyerWithRelated()` from `cascadeDelete.ts` which properly cleans up related records (contacts, transcripts, scores, call intelligence)
- Uses existing `queueBuyers()` from the enrichment queue hook for single-buyer enrichment
- Bulk delete requires confirmation dialog before proceeding
- All operations invalidate the buyers query to refresh the table

### Result

After implementation:
- Row dropdown will show "Enrich Data" and "Delete" options
- Bulk action bar will show both "Remove from Universe" and "Delete Permanently" buttons when buyers are selected
