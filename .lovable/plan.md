# Phase 4: My Deals, Messages, Profile & Saved Listings — Mobile Optimization

## Issues Found

### Issue 1: My Deals — Detail Panel Padding Too Large on Mobile
**File:** `src/pages/MyRequests.tsx` lines 230, 234, 352, 392, 472, 476
Multiple `px-6` and `p-6` values create excessive padding on 375px screens (48px of horizontal space lost).

**Fix:** Change to `px-4 sm:px-6` on:
- Line 230: Page header container
- Line 234: Main content container
- Line 352: Tab bar container
- Line 392: Overview tab content (`p-6` → `p-4 sm:p-6`)
- Line 472: Messages tab content
- Line 476: Activity tab content

### Issue 2: DealActionCard CTA Button Wraps Poorly on Mobile
**File:** `src/components/deals/DealActionCard.tsx` line 135
The `flex items-start justify-between gap-4` layout places the CTA button on the same row as the text. On 375px, the button gets crushed or the text is too narrow.

**Fix:** Change layout to `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4`. Move button to full-width below text on mobile.

### Issue 3: DealDetailHeader Title + EBITDA Side-by-Side Cramped
**File:** `src/components/deals/DealDetailHeader.tsx` line 58
Title and EBITDA are in `flex items-start justify-between gap-4`. On mobile, long titles get truncated too aggressively.

**Fix:** Change to `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4`. EBITDA stacks below title on mobile.

### Issue 4: Messages Page — Skeleton Uses Fixed 300px Width
**File:** `src/pages/BuyerMessages/MessageThread.tsx` line 253
`BuyerMessagesSkeleton` hardcodes `w-[300px]` for the sidebar skeleton.

**Fix:** Change to `w-full md:w-[300px]`.

### Issue 5: Profile Page — 5 Tab Triggers Overflow Horizontally
**File:** `src/pages/Profile/index.tsx` line 53
Five tabs ("Profile Information", "Documents", "Deal Alerts", "Team", "Security") in a single `TabsList` with no horizontal scroll or wrapping. On 375px this overflows.

**Fix:** Add `overflow-x-auto` to TabsList wrapper, and shorten tab labels on mobile: "Profile Information" → "Profile" using `<span className="sm:hidden">Profile</span><span className="hidden sm:inline">Profile Information</span>`.

### Issue 6: Profile Page Title Too Large
**File:** `src/pages/Profile/index.tsx` line 50
`text-3xl font-bold` is 30px — wraps to 2 lines on mobile.

**Fix:** Change to `text-2xl sm:text-3xl`.

### Issue 7: My Deals — Sidebar Pipeline Max-Height Too Large on Mobile
**File:** `src/pages/MyRequests.tsx` line 256
`max-h-[calc(100vh-200px)]` is fine on desktop but on mobile the sidebar should show all deals with a reasonable max.

**Fix:** No change needed — `isMobile` already triggers `flex-col` so the sidebar is full-width with natural height. But add `max-h-[300px]` specifically when mobile to prevent a long deal list from pushing the detail panel offscreen. Change to `max-h-[300px] md:max-h-[calc(100vh-200px)]`.

### Issue 8: DealMessagesTab — Fixed min-h/max-h on Mobile
**File:** `src/components/deals/DealMessagesTab.tsx` line 92
`min-h-[300px] max-h-[500px]` is fine on desktop but on mobile 500px is the entire viewport.

**Fix:** Change to `min-h-[200px] sm:min-h-[300px] max-h-[350px] sm:max-h-[500px]`.

### Issue 9: BuyerDataRoom VaultHeader — "Confidential" Text Hidden on Small Screens
**File:** `src/components/marketplace/BuyerDataRoom.tsx` line 485
The `CONFIDENTIAL` label and close button are in a flex row with the title. On very small screens the gap between them causes wrapping.

**Fix:** Hide "Confidential" text on very small screens: `hidden sm:inline`.

### Issue 10: DealDocumentsCard — Locked Items Text Overflow
**File:** `src/components/deals/DealDocumentsCard.tsx` lines 333-344
The "Confidential Company Profile", "Deal Memorandum / CIM", "Detailed Financial Statements" text at `text-[12px]` with icon + lock layout fits 375px but is tight.

**Fix:** No change needed — text is short enough and `truncate` is not applied. Fine as-is.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/MyRequests.tsx` | Responsive padding, mobile sidebar max-height |
| `src/components/deals/DealActionCard.tsx` | Stack CTA below text on mobile |
| `src/components/deals/DealDetailHeader.tsx` | Stack EBITDA below title on mobile |
| `src/components/deals/DealMessagesTab.tsx` | Smaller min/max-h on mobile |
| `src/pages/BuyerMessages/MessageThread.tsx` | Skeleton responsive width |
| `src/pages/Profile/index.tsx` | Scrollable tabs, shorter labels, smaller title |
| `src/components/marketplace/BuyerDataRoom.tsx` | Hide "Confidential" on very small screens |

## Implementation Order

1. MyRequests responsive padding + sidebar height
2. DealActionCard stacking layout
3. DealDetailHeader stacking layout
4. DealMessagesTab responsive heights
5. BuyerMessages skeleton width
6. Profile tabs + title
7. BuyerDataRoom vault header
