

# Phase 2: Marketplace Browse — Mobile Optimization

## Issues Found

### Issue 1: List View Card Layout Breaks on Mobile
**File:** `src/components/listing/ListingCardImage.tsx` line 37
The list view image uses `w-1/4 min-w-[200px]`. On a 375px screen, the image takes 200px leaving only 175px for all content — title, financials, description, and actions get crushed.

**Fix:** On mobile, force list view cards to stack vertically like grid cards. In `ListingCard.tsx` line 114, change the list layout from `flex flex-row` to `flex flex-col sm:flex-row`. In `ListingCardImage.tsx` line 37, change `w-1/4 min-w-[200px]` to `w-full sm:w-1/4 sm:min-w-[200px]`.

### Issue 2: Financials Grid — 4 Columns Overflow on Mobile List View
**File:** `src/components/listing/ListingCardFinancials.tsx` line 29
In list view, financials use `grid-cols-4`. On mobile this creates 4 tiny columns with text wrapping. In grid view, `grid-cols-2` works fine.

**Fix:** Change list view grid to `grid-cols-2 sm:grid-cols-4` so financials stack 2x2 on mobile.

### Issue 3: Pagination "Previous" / "Next" Labels Cause Overflow
**File:** `src/components/ui/pagination.tsx` lines 72-73, 88-89
`PaginationPrevious` renders "Previous" and `PaginationNext` renders "Next" text. Combined with page numbers, this overflows on 375px.

**Fix:** Hide text labels on mobile: wrap `<span>` in `<span className="hidden sm:inline">`. Keep chevron icons always visible.

### Issue 4: Title "Off-Market, Founder-Led Deals" Too Long on Mobile
**File:** `src/pages/Marketplace.tsx` line 179
The `text-3xl` heading wraps to 3 lines on 375px.

**Fix:** Change to `text-2xl sm:text-3xl`.

### Issue 5: Listing Card Padding `p-6` Excessive on Mobile Grid
**File:** `src/components/ListingCard.tsx` line 151
Grid cards use `p-6` (24px), which eats 48px of horizontal space on a 375px screen.

**Fix:** Change to `p-4 sm:p-6` for grid view.

### Issue 6: Listing Card Status Badges Wrap Poorly on Mobile
**File:** `src/components/listing/ListingCardTitle.tsx` lines 26-83
The "Request Pending" badge + "View Status" link render side-by-side (`flex items-center gap-2`). On mobile they overflow the card.

**Fix:** Change to `flex flex-wrap items-center gap-2` so they stack naturally.

### Issue 7: Financial Numbers Too Large on Mobile
**File:** `src/components/listing/ListingCardFinancials.tsx` line 36
Grid view financial numbers are `text-[21px]`. On 375px with 2 columns this works but is tight for longer currency strings.

**Fix:** Change to `text-[18px] sm:text-[21px]` for breathing room.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Marketplace.tsx` | Smaller heading on mobile |
| `src/components/ListingCard.tsx` | Responsive padding, list view stacks vertically on mobile |
| `src/components/listing/ListingCardImage.tsx` | Full-width image on mobile list view |
| `src/components/listing/ListingCardFinancials.tsx` | 2-col grid on mobile list view, smaller numbers |
| `src/components/listing/ListingCardTitle.tsx` | flex-wrap on status badges |
| `src/components/ui/pagination.tsx` | Hide "Previous"/"Next" text on mobile |

## Implementation Order

1. Marketplace heading size
2. ListingCard padding + list-view stacking
3. ListingCardImage full-width mobile
4. ListingCardFinancials responsive grid + font
5. ListingCardTitle flex-wrap
6. Pagination text hidden on mobile

