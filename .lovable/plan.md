
# Phase 4: My Deals, Messages, Profile & Saved Listings — Mobile Optimization

## Issues Found

### Issue 1: My Deals — Detail Panel Padding Too Large on Mobile
**File:** `src/pages/MyRequests.tsx` lines 230, 234, 352, 392, 472, 476
Multiple `px-6` and `p-6` values create excessive padding on 375px screens.

**Fix:** Change to `px-4 sm:px-6` on page header, main content, tab bar, and tab content areas.

### Issue 2: DealActionCard CTA Button Wraps Poorly on Mobile
**File:** `src/components/deals/DealActionCard.tsx` line 135
CTA button sits side-by-side with text, gets crushed on mobile.

**Fix:** Stack vertically on mobile: `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4`. Button becomes full-width below text.

### Issue 3: DealDetailHeader Title + EBITDA Cramped
**File:** `src/components/deals/DealDetailHeader.tsx` line 58
Title and EBITDA compete for space on mobile.

**Fix:** Stack vertically: `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4`.

### Issue 4: Messages Skeleton Fixed 300px Width
**File:** `src/pages/BuyerMessages/MessageThread.tsx` line 253
Skeleton hardcodes `w-[300px]`.

**Fix:** Change to `w-full md:w-[300px]`.

### Issue 5: Profile Page — 5 Tabs Overflow
**File:** `src/pages/Profile/index.tsx` line 53
Five tabs overflow horizontally on 375px.

**Fix:** Add `flex-wrap` to TabsList, shorten "Profile Information" to just "Profile" on mobile.

### Issue 6: Profile Title Too Large
**File:** `src/pages/Profile/index.tsx` line 50
`text-3xl` wraps on mobile.

**Fix:** Change to `text-2xl sm:text-3xl`.

### Issue 7: My Deals Sidebar — Long Deal List Pushes Content Off
**File:** `src/pages/MyRequests.tsx` line 256
On mobile the sidebar list can be very long.

**Fix:** Change `max-h-[calc(100vh-200px)]` to `max-h-[300px] md:max-h-[calc(100vh-200px)]`.

### Issue 8: DealMessagesTab Heights Too Large on Mobile
**File:** `src/components/deals/DealMessagesTab.tsx` line 92
`min-h-[300px] max-h-[500px]` fills the entire mobile viewport.

**Fix:** Change to `min-h-[200px] sm:min-h-[300px] max-h-[350px] sm:max-h-[500px]`.

### Issue 9: VaultHeader "Confidential" Crowds Close Button on Small Screens
**File:** `src/components/marketplace/BuyerDataRoom.tsx` line 485
Label and button compress on narrow screens.

**Fix:** Hide "Confidential" on very small screens: `hidden sm:inline`.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/MyRequests.tsx` | Responsive padding, mobile sidebar max-height |
| `src/components/deals/DealActionCard.tsx` | Stack CTA below text on mobile |
| `src/components/deals/DealDetailHeader.tsx` | Stack EBITDA below title on mobile |
| `src/components/deals/DealMessagesTab.tsx` | Smaller min/max-h on mobile |
| `src/pages/BuyerMessages/MessageThread.tsx` | Skeleton responsive width |
| `src/pages/Profile/index.tsx` | Wrapped tabs, shorter labels, smaller title |
| `src/components/marketplace/BuyerDataRoom.tsx` | Hide "Confidential" on small screens |

## Implementation Order

1. MyRequests responsive padding + sidebar height
2. DealActionCard stacking layout
3. DealDetailHeader stacking layout
4. DealMessagesTab responsive heights
5. BuyerMessages skeleton width
6. Profile tabs + title
7. BuyerDataRoom vault header
