
# Fix Drag-and-Drop Ranking on All Deals Page

## The Problem

When you drag a company from position 3 to position 1, the ranking numbers are not updating correctly. The expected behavior is:
- The dragged company takes the new rank number (becomes #1)
- All other companies shift their numbers accordingly (old #1 becomes #2, old #2 becomes #3, etc.)

## Root Cause

The current drag-and-drop handler has a "stale closure" bug - a common React issue where callbacks don't see the latest data. It's also only updating some items instead of all affected items.

## Solution Overview

I'll fix the ranking logic so that:
1. The position numbers (1, 2, 3, 4, 5...) stay in order at all times
2. When you drag a company to a new spot, it takes that position's number
3. All other companies automatically adjust their numbers to fill the gap

## Visual Example

```text
BEFORE DRAG:          AFTER DRAGGING #3 TO #1:
#1 - Company A        #1 - Company C  ← (was #3)
#2 - Company B        #2 - Company A  ← (was #1, shifted down)
#3 - Company C        #3 - Company B  ← (was #2, shifted down)
#4 - Company D        #4 - Company D  ← (unchanged)
```

---

## Technical Implementation

### File: `src/pages/admin/remarketing/ReMarketingDeals.tsx`

**Change 1: Add a ref to track current listings**

Add a `useRef` that always holds the latest sorted listings, so the drag handler never uses stale data:

```typescript
import { useState, useMemo, useCallback, useRef, useEffect } from "react";

// Inside component:
const sortedListingsRef = useRef<DealListing[]>([]);

// Keep ref in sync with state
useEffect(() => {
  sortedListingsRef.current = sortedListings;
}, [sortedListings]);
```

**Change 2: Add local state for optimistic UI updates**

Track local order so the UI updates instantly without waiting for the database:

```typescript
const [localOrder, setLocalOrder] = useState<DealListing[]>([]);

useEffect(() => {
  setLocalOrder(sortedListings);
}, [sortedListings]);
```

**Change 3: Rewrite the drag handler**

The new handler will:
1. Read from the ref (always current data)
2. Reorder the array using `arrayMove`
3. Assign sequential ranks (1, 2, 3, 4...) to ALL items
4. Update the UI immediately (optimistic update)
5. Persist all new ranks to the database

```typescript
const handleDragEnd = useCallback(async (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const currentListings = sortedListingsRef.current;
  const oldIndex = currentListings.findIndex((l) => l.id === active.id);
  const newIndex = currentListings.findIndex((l) => l.id === over.id);

  if (oldIndex === -1 || newIndex === -1) return;

  // Reorder the array
  const reordered = arrayMove(currentListings, oldIndex, newIndex);
  
  // Assign sequential ranks to ALL items (1, 2, 3, 4, ...)
  const updatedListings = reordered.map((listing, idx) => ({
    ...listing,
    manual_rank_override: idx + 1,
  }));

  // Optimistically update UI immediately
  setLocalOrder(updatedListings);

  // Persist ALL ranks to database
  const updates = updatedListings.map((listing) => ({
    id: listing.id,
    manual_rank_override: listing.manual_rank_override,
  }));

  try {
    for (const update of updates) {
      await supabase
        .from('listings')
        .update({ manual_rank_override: update.manual_rank_override })
        .eq('id', update.id);
    }
    
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
    toast({ title: "Rank updated", description: `Deal moved to position ${newIndex + 1}` });
  } catch (error) {
    // Revert on failure
    setLocalOrder(currentListings);
    toast({ title: "Failed to update rank", variant: "destructive" });
  }
}, [queryClient, toast]);
```

**Change 4: Update the displayed list source**

The DndContext and table should use `localOrder` instead of `sortedListings` for immediate visual feedback:

```typescript
<SortableContext items={localOrder.map(l => l.id)} strategy={verticalListSortingStrategy}>
  {localOrder.map((listing, index) => (
    <SortableTableRow
      key={listing.id}
      listing={listing}
      index={index}
      // ... other props
    />
  ))}
</SortableContext>
```

**Change 5: Update rank display in SortableTableRow**

Always show the position-based rank (index + 1), which now comes from the correctly-ordered local state:

```typescript
<span className="font-medium text-muted-foreground w-5 text-center">
  {index + 1}
</span>
```

---

## Summary of Changes

| What | Why |
|------|-----|
| Add `useRef` for listings | Prevents stale closure bug in drag handler |
| Add `localOrder` state | Enables instant UI updates before database confirms |
| Update ALL ranks on drag | Ensures sequential numbering (1, 2, 3, 4...) |
| Use `index + 1` for display | Shows actual position, not stored value |

## Testing Checklist

After implementation, verify:
- [ ] Drag item #3 to position #1 → it becomes #1, others shift down
- [ ] Drag item #1 to position #5 → it becomes #5, items 2-5 shift up to become 1-4
- [ ] Numbers always remain 1, 2, 3, 4, 5... (no gaps or duplicates)
- [ ] Page refresh preserves the new order
- [ ] Sorting by other columns still works
