
## Add Buyer Source Badge to Pipeline Kanban Cards

### What Changes
Each pipeline kanban card will display a small source badge (e.g., "Remarketing", "Marketplace", "Manual") so you can instantly see where each buyer came from without opening the deal.

### Where It Goes
The badge will appear in the **footer row** (line 174 area), next to the "Owner" label -- a compact colored badge between owner and the last-activity timestamp, keeping the card's density manageable.

### Technical Details

**File: `src/components/admin/pipeline/views/PipelineKanbanCard.tsx`**

1. Import the existing `DealSourceBadge` component from `@/components/remarketing/DealSourceBadge`
2. In the footer section (around line 174-188), add `<DealSourceBadge source={deal.deal_source} />` between the Owner text and the activity/unread cluster
3. No data fetching changes needed -- `deal.deal_source` is already available on every deal object (`'remarketing'`, `'captarget'`, `'manual'`, `'referral'`, etc.)

The `DealSourceBadge` component already handles all source types with appropriate color coding (blue for CapTarget, indigo for Remarketing, gray for Manual, etc.), so no new styling is needed.

**File: `src/components/admin/pipeline/views/PipelineKanbanCardOverlay.tsx`** (optional)

Add the same badge to the drag overlay for visual consistency.
