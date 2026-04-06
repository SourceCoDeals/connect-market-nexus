

# Phase 1 Audit: Mobile Optimization Fixes

## Testing Summary

Tested at 375px viewport: Login, Signup, Welcome, Forgot Password pages. Code-audited all user-facing pages for mobile responsiveness.

## Issues Found

### Issue 1: Data Room Modal — Not Full-Screen on Mobile
**File:** `src/pages/ListingDetail.tsx` line 308
The `DialogContent` has `max-w-3xl` but no mobile override. On 375px, the dialog renders with default padding/margins from DialogContent (`left-[50%] translate-x-[-50%]` with `w-full max-w-lg` base), making it too narrow. The `max-h-[80vh]` in BuyerDataRoom is fine, but the dialog needs full-width + full-height on mobile.

**Fix:** Add responsive classes: `sm:max-w-3xl max-w-[calc(100vw-16px)] sm:max-h-[80vh] max-h-[calc(100vh-32px)]` to DialogContent.

### Issue 2: Data Room — View/Download Buttons Hidden on Touch (opacity-0 hover)
**File:** `src/components/marketplace/BuyerDataRoom.tsx` line 411
Document action buttons use `opacity-0 group-hover:opacity-100` — on mobile touch devices, hover doesn't exist. Buttons are invisible and untappable.

**Fix:** Change to `opacity-0 group-hover:opacity-100 md:opacity-0 max-md:opacity-100` so buttons are always visible on mobile.

### Issue 3: Messages — ConversationList Fixed Width 300px on Mobile
**File:** `src/pages/BuyerMessages/ConversationList.tsx` line 44
The conversation list has `w-[300px]` which fills most of a 375px screen but leaves an awkward 75px gap on the right. On mobile (when no thread selected), it should be full-width.

**Fix:** Change to `w-full md:w-[300px]`.

### Issue 4: Marketplace — "Results per page" Label Wraps Awkwardly on Mobile
**File:** `src/pages/Marketplace.tsx` lines 256-302
The toolbar row with "View:", "Results per page:", and sorting Select boxes wraps awkwardly on small screens. The "Results per page:" label is too wide.

**Fix:** Hide "Results per page:" text on mobile, keep just the Select. Use `hidden sm:inline` on the label span.

### Issue 5: Listing Detail — Padding Too Large on Mobile
**File:** `src/pages/ListingDetail.tsx` line 171, 183
- `px-8` on the back navigation is excessive on 375px (32px each side = 64px lost)
- `px-6 py-8` on main content is also large

**Fix:** Change to `px-4 sm:px-8` and `px-4 sm:px-6` respectively.

### Issue 6: Listing Detail — Sidebar CTA Card on Mobile Needs Spacing
**File:** `src/pages/ListingDetail.tsx` line 330
The sidebar renders below the main content on mobile (`grid-cols-1 lg:grid-cols-10`). The `p-6` padding is fine but the `gap-10` between grid items creates excessive vertical space.

**Fix:** Change to `gap-6 lg:gap-10`.

### Issue 7: Data Room in DealDocumentsCard — View/Download Also Hidden on Touch
**File:** `src/components/deals/DealDocumentsCard.tsx`
Same hover-only visibility pattern likely exists here.

**Fix:** Apply same `max-md:opacity-100` fix.

### Issue 8: Marketplace Listing Grid — Single Column but Sort Controls Overflow
**File:** `src/pages/Marketplace.tsx` line 261
The `flex flex-wrap items-center gap-4` toolbar works but items like "Sort by:" selector may cause horizontal scroll on very small screens.

**Fix:** Add `overflow-hidden` to parent and use `text-xs` on mobile for the sort labels.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/ListingDetail.tsx` | Mobile padding (px-4), dialog full-width on mobile, gap-6 on grid |
| `src/components/marketplace/BuyerDataRoom.tsx` | Always-visible action buttons on mobile |
| `src/pages/BuyerMessages/ConversationList.tsx` | Full-width conversation list on mobile |
| `src/pages/Marketplace.tsx` | Hide verbose labels on mobile, prevent toolbar overflow |
| `src/components/deals/DealDocumentsCard.tsx` | Always-visible action buttons on mobile |

## Implementation Order

1. ListingDetail padding + dialog mobile sizing
2. BuyerDataRoom touch-friendly buttons
3. ConversationList full-width mobile
4. Marketplace toolbar mobile cleanup
5. DealDocumentsCard touch-friendly buttons

