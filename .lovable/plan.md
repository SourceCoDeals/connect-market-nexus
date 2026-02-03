
# Add Archive Deal & Multi-Select Functionality

## Overview
Add the ability to archive individual deals from the dropdown menu and enable multi-select functionality to archive multiple deals at once on the ReMarketing Deals page.

## Current State Analysis
- The deals table shows only `status = 'active'` deals (line 597 in query)
- No archive functionality exists on this page
- No multi-select capability exists on this page
- The `listings` table has a `status` column (TEXT, NOT NULL) with current values: `active`, `inactive`
- The codebase has existing patterns for multi-select in `TrackerDealsTab.tsx` using `Set<string>`
- The `BulkActionsToolbar` component exists but is designed for buyer approval/passing, not deal archiving

## Implementation Plan

### 1. Add Multi-Select State Management
Add selection state and handlers to `ReMarketingDeals.tsx`:
- `selectedDeals: Set<string>` - tracks selected deal IDs
- `handleToggleSelect(dealId)` - toggles individual selection
- `handleSelectAll()` - selects/deselects all visible deals
- `handleClearSelection()` - clears all selections

### 2. Add Archive Functions
- `handleArchiveDeal(dealId, dealName)` - archive single deal by setting `status: 'archived'`
- `handleBulkArchive()` - archive all selected deals with confirmation dialog
- `isArchiving` state for loading indicator
- `showArchiveDialog` state for confirmation modal

### 3. Update Table Structure

**Add Checkbox Column:**
- New column before the rank/drag handle column
- Header: "Select all" checkbox
- Row: Individual checkbox for each deal

**Update ColumnWidths interface:**
```typescript
interface ColumnWidths {
  select: number;  // NEW: 40px
  rank: number;
  dealName: number;
  // ... rest unchanged
}
```

### 4. Update SortableTableRow Component
Add new props:
- `isSelected: boolean`
- `onToggleSelect: (dealId: string) => void`
- `onArchive: (dealId: string, dealName: string) => void`

Add checkbox cell at the start of the row.

Add "Archive Deal" menu item to the dropdown menu with red styling.

### 5. Add Bulk Actions Toolbar
Insert a sticky toolbar between the filters card and the deals table when `selectedDeals.size > 0`:
- Shows count of selected deals with badge
- "Clear" button to clear selection
- "Archive Selected" button (red styling) that opens confirmation dialog
- Optional: "Export CSV" button for selected deals

### 6. Add Archive Confirmation Dialog
AlertDialog component with:
- Title: "Archive X Deal(s)?"
- Description: "This will move the selected deals to the archive. They will no longer appear in the active deals list."
- Cancel and Archive buttons
- Loading state during archive operation

## Technical Details

### File: `src/pages/admin/remarketing/ReMarketingDeals.tsx`

**New Imports:**
```typescript
import { Archive, XCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
```

**New State (around line 460-475):**
```typescript
const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
const [isArchiving, setIsArchiving] = useState(false);
const [showArchiveDialog, setShowArchiveDialog] = useState(false);
```

**New Handler Functions (after line 963):**
```typescript
const handleToggleSelect = (dealId: string) => {
  const newSelected = new Set(selectedDeals);
  if (newSelected.has(dealId)) {
    newSelected.delete(dealId);
  } else {
    newSelected.add(dealId);
  }
  setSelectedDeals(newSelected);
};

const handleSelectAll = () => {
  if (selectedDeals.size === localOrder.length) {
    setSelectedDeals(new Set());
  } else {
    setSelectedDeals(new Set(localOrder.map(d => d.id)));
  }
};

const handleClearSelection = () => {
  setSelectedDeals(new Set());
};

const handleArchiveDeal = async (dealId: string, dealName: string) => {
  const { error } = await supabase
    .from('listings')
    .update({ status: 'archived' })
    .eq('id', dealId);
  
  if (error) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
    return;
  }
  
  toast({ title: "Deal archived", description: `${dealName} has been archived` });
  refetchListings();
};

const handleBulkArchive = async () => {
  setIsArchiving(true);
  try {
    const dealIds = Array.from(selectedDeals);
    const { error } = await supabase
      .from('listings')
      .update({ status: 'archived' })
      .in('id', dealIds);
    
    if (error) throw error;
    
    toast({ 
      title: "Deals archived", 
      description: `${dealIds.length} deal(s) have been archived` 
    });
    setSelectedDeals(new Set());
    setShowArchiveDialog(false);
    refetchListings();
  } catch (error: any) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  } finally {
    setIsArchiving(false);
  }
};
```

**Update SortableTableRow Props (line 210-232):**
Add to interface:
```typescript
isSelected: boolean;
onToggleSelect: (dealId: string) => void;
onArchive: (dealId: string, dealName: string) => void;
```

**Add Checkbox Cell in SortableTableRow (before line 271):**
```tsx
<TableCell 
  onClick={(e) => e.stopPropagation()} 
  style={{ width: 40, minWidth: 40 }}
>
  <Checkbox
    checked={isSelected}
    onCheckedChange={() => onToggleSelect(listing.id)}
  />
</TableCell>
```

**Add Archive Menu Item to Dropdown (after line 448):**
```tsx
<DropdownMenuSeparator />
<DropdownMenuItem
  onClick={(e) => {
    e.stopPropagation();
    onArchive(listing.id, displayName || 'Unknown Deal');
  }}
  className="text-red-600 focus:text-red-600"
>
  <Archive className="h-4 w-4 mr-2" />
  Archive Deal
</DropdownMenuItem>
```

**Update Column Widths (line 117-146):**
```typescript
interface ColumnWidths {
  select: number;  // Add this
  rank: number;
  // ... rest unchanged
}

const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  select: 40,  // Add this
  rank: 60,
  // ... rest unchanged
};
```

**Add Bulk Actions Toolbar (between filters card ~line 1213 and deals table card ~line 1257):**
```tsx
{selectedDeals.size > 0 && (
  <Card className="border-primary/20 bg-primary/5">
    <CardContent className="p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="text-sm font-medium">
          {selectedDeals.size} selected
        </Badge>
        <Button variant="ghost" size="sm" onClick={handleClearSelection}>
          <XCircle className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="text-red-600 border-red-200 hover:bg-red-50"
        onClick={() => setShowArchiveDialog(true)}
      >
        <Archive className="h-4 w-4 mr-1" />
        Archive Selected
      </Button>
    </CardContent>
  </Card>
)}
```

**Add Archive Confirmation Dialog (after Import Dialog ~line 1255):**
```tsx
<AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Archive {selectedDeals.size} Deal(s)?</AlertDialogTitle>
      <AlertDialogDescription>
        This will move the selected deals to the archive. They will no longer 
        appear in the active deals list.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleBulkArchive}
        disabled={isArchiving}
        className="bg-red-600 hover:bg-red-700"
      >
        {isArchiving ? "Archiving..." : "Archive"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Add Select All Checkbox in Table Header (line 1268-1303):**
Insert new header cell before the rank column:
```tsx
<th 
  className="h-10 px-3 text-left align-middle font-medium text-muted-foreground border-b" 
  style={{ width: columnWidths.select, minWidth: 40 }}
>
  <Checkbox
    checked={localOrder.length > 0 && selectedDeals.size === localOrder.length}
    onCheckedChange={handleSelectAll}
  />
</th>
```

**Update SortableTableRow Usage (line 1337-1349):**
Pass new props:
```tsx
<SortableTableRow
  key={listing.id}
  listing={listing}
  index={index}
  stats={scoreStats?.[listing.id]}
  navigate={navigate}
  formatCurrency={formatCurrency}
  formatWebsiteDomain={formatWebsiteDomain}
  getEffectiveWebsite={getEffectiveWebsite}
  formatGeographyBadges={formatGeographyBadges}
  getScoreTrendIcon={getScoreTrendIcon}
  columnWidths={columnWidths}
  isSelected={selectedDeals.has(listing.id)}
  onToggleSelect={handleToggleSelect}
  onArchive={handleArchiveDeal}
/>
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/remarketing/ReMarketingDeals.tsx` | Add selection state, handlers, checkbox column, bulk toolbar, archive dialog, archive dropdown menu item |

## UI/UX Flow

1. **Individual Archive**: User clicks `...` menu on a deal row → sees new "Archive Deal" option (red text) → clicks it → deal is immediately archived and removed from view

2. **Multi-Select**: User clicks checkbox on one or more deals → a sticky toolbar appears showing count and action buttons

3. **Bulk Archive**: User clicks "Archive Selected" button → confirmation dialog appears → user confirms → all selected deals are archived and removed from view

4. **Clear Selection**: User can clear all selections via the "Clear" button in the toolbar

## Database Impact
- No schema changes required
- Uses existing `status` column on `listings` table  
- Sets `status = 'archived'` to archive deals (new value alongside `active` and `inactive`)
- Query already filters to `status = 'active'` so archived deals automatically disappear from view
