

# Phase 5: Connection Request System — `on_hold` Support in Buyer-Facing Deal Components

## Verification: All Previous Phases Confirmed

All fixes from Phases 1-4 are verified implemented:
- Profile/fee/buyer gates on marketplace cards
- Fee gate fallback for missing firmId
- Dead `ndaGateDismissed` removed
- Navigation wired on "View Deal Details" and "Details" buttons
- `on_hold` case in `ConnectionButton` and `ListingCardActions`
- Card click propagation fix for `<a>` elements
- Profile link fix in `ConnectionRequestDialog`
- Browse Marketplace CTA in empty state
- Success toast mentions My Deals
- `onFeeGateOpen` wired in ListingCard

## Remaining Issue: `on_hold` Not Handled in My Deals Page

The admin can set a connection request to `on_hold`, but the buyer's My Deals page drops this status everywhere via unsafe type casts. When a request is `on_hold`:

1. **`DealPipelineCard`** — `getStatusLabel()` has no `on_hold` case, falls through to default ("Under Review"). This is acceptable behavior but should be explicit.

2. **`DealActionCard`** — Interface only accepts `'pending' | 'approved' | 'rejected'`. When `on_hold` is cast away, it falls through to the pending branch (shows "Under Review" or signing prompts). Should show a dedicated "On Hold" state.

3. **`DealDetailHeader`** — Same 3-value union. `getStatusConfig()` has no `on_hold` case, falls to default which shows "Under Review". Should show explicit "On Hold" label.

4. **`DealDocumentsCard`** — Same 3-value union. No behavioral impact (documents are shown based on `ndaSigned`/`feeCovered`, not status), but the type is wrong.

5. **`DealStatusSection`** — Same 3-value union. No `on_hold` rendering.

6. **`MyRequests.tsx`** lines 348, 397, 408 — All cast `requestStatus as 'pending' | 'approved' | 'rejected'`, silently discarding `on_hold`.

## Fixes

### 1. Add `on_hold` to all type unions

Update the `requestStatus` prop type in these components from `'pending' | 'approved' | 'rejected'` to `'pending' | 'approved' | 'rejected' | 'on_hold'`:
- `DealActionCard.tsx`
- `DealDetailHeader.tsx`
- `DealDocumentsCard.tsx`
- `DealStatusSection.tsx`

### 2. Add `on_hold` rendering in `DealActionCard`

Show a dedicated state: "Request On Hold" with description explaining the owner is still evaluating. Use the `waiting` variant (same styling as extended pending).

### 3. Add `on_hold` case in `DealDetailHeader.getStatusConfig()`

Show label "On Hold" with amber/neutral styling.

### 4. Add explicit `on_hold` case in `DealPipelineCard.getStatusLabel()`

Return `{ label: 'On Hold', needsAction: false }` instead of falling through to default.

### 5. Fix casts in `MyRequests.tsx`

Change all `as 'pending' | 'approved' | 'rejected'` casts to include `| 'on_hold'`.

## Files Changed

| File | Change |
|------|--------|
| `src/components/deals/DealActionCard.tsx` | Add `on_hold` to type union + dedicated action state |
| `src/components/deals/DealDetailHeader.tsx` | Add `on_hold` to type union + status config case |
| `src/components/deals/DealDocumentsCard.tsx` | Add `on_hold` to type union |
| `src/components/deals/DealStatusSection.tsx` | Add `on_hold` to type union |
| `src/components/deals/DealPipelineCard.tsx` | Add explicit `on_hold` case in `getStatusLabel()` |
| `src/pages/MyRequests.tsx` | Fix 3 type casts to include `on_hold` |

