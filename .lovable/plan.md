

# Phase 7: Admin Panel — Mobile Optimization

## Audit Summary

Tested AdminLayout, AdminNavbar, AdminDashboard, AdminUsers, AdminRequests, MessageCenter, ListingsManagementTabs, AdminNotificationBell, CreateDealModal, and UniversalSearchDialog at 375px viewport. The AdminNavbar (mobile hamburger with Sheet drawer) is already well-built with touch-friendly 44px tap targets and responsive widths.

## Issues Found

### Issue 1: Global `px-8` Padding on All Admin Pages
**Files:** AdminDashboard.tsx (lines 130, 250, 273), AdminUsers.tsx (lines 347, 399), InternalTeamPage.tsx (105, 123), OwnerLeadsPage.tsx (127, 138), ContactListsPage.tsx (100, 121), ContactListDetailPage.tsx (193, 251), MarketplaceUsersPage.tsx (167, 189), TestingHub.tsx (782, 842, 855), StandupTracker.tsx (416), DailyTaskDashboard.tsx (151)

`px-8` = 64px total horizontal padding. On 375px inside AdminLayout (which adds `p-4` = 16px each side), content width shrinks to ~279px. Every admin page uses this pattern.

**Fix:** Change all `px-8` to `px-4 md:px-8` across these files. This is the single highest-impact fix.

### Issue 2: AdminDashboard — Dashboard Switcher Overflows on Mobile
**File:** `src/pages/admin/AdminDashboard.tsx` lines 209-243
The three-button switcher (Daily Tasks / Remarketing / Marketplace) uses `px-4` per button. On 375px with reduced padding, the row still fits ~300px of buttons. But the marketplace sub-tabs row (line 251) has 8 tabs that will overflow.

**Fix:** Add `overflow-x-auto` to the marketplace sub-tabs container (line 251). Dashboard switcher is fine as-is.

### Issue 3: AdminNotificationBell Popover Width
**File:** `src/components/admin/AdminNotificationBell.tsx` line 115
`w-96` (384px) overflows 375px viewport.

**Fix:** Change to `w-[calc(100vw-2rem)] sm:w-96`.

### Issue 4: MessageCenter Thread List Fixed 320px Width
**File:** `src/pages/admin/MessageCenter.tsx` line 484
`w-[320px]` is hardcoded. On mobile, this takes the full 375px viewport leaving no room for content. The show/hide logic (`hidden md:flex` / `flex`) already works correctly for mobile — when a thread is selected the list hides and thread view shows. But when no thread is selected, the 320px list doesn't fill the screen.

**Fix:** Change `w-[320px]` to `w-full md:w-[320px]` so the list fills mobile width.

### Issue 5: MessageCenter View Mode Toggle Overflows on Mobile
**File:** `src/pages/admin/MessageCenter.tsx` lines 382-430
Three buttons (All / By Deal / By Buyer) in a row next to the "Inbox" title. On narrow screens, the buttons compress.

**Fix:** Hide labels on mobile, show only icons: wrap text in `<span className="hidden sm:inline">`. The icons alone are sufficient with their distinct shapes.

### Issue 6: ListingsManagementTabs — Tab Labels Too Long for Mobile
**File:** `src/components/admin/ListingsManagementTabs.tsx` lines 88-113
Three tabs: "Ready to Publish", "Live on Marketplace", "All Internal" — with badges. On 375px these overflow the TabsList.

**Fix:** Use shorter labels on mobile: "Ready" / "Live" / "Internal" using `<span className="sm:hidden">` / `<span className="hidden sm:inline">` pattern.

### Issue 7: ListingsManagementTabs — `px-6 lg:px-10` Container Padding
**File:** `src/components/admin/ListingsManagementTabs.tsx` line 73
`px-6` = 48px total, stacked on AdminLayout's `p-4`. Leaves ~263px on 375px.

**Fix:** Change to `px-2 sm:px-6 lg:px-10`.

### Issue 8: MessageCenter Header `px-6` Excessive
**File:** `src/pages/admin/MessageCenter.tsx` line 374
Same stacking issue with AdminLayout's `p-4`.

**Fix:** Change `px-6 pt-6 pb-4` to `px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4`.

### Issue 9: CreateDealModal Already Responsive
`max-w-2xl max-h-[90vh] md:max-h-[85vh] overflow-y-auto` — this is fine on mobile. No fix needed.

### Issue 10: UniversalSearchDialog Uses CommandDialog
CommandDialog renders as a centered overlay. No mobile issues. No fix needed.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/AdminDashboard.tsx` | `px-4 md:px-8` on 3 containers; `overflow-x-auto` on marketplace sub-tabs |
| `src/pages/admin/AdminUsers.tsx` | `px-4 md:px-8` on header + content |
| `src/pages/admin/InternalTeamPage.tsx` | `px-4 md:px-8` |
| `src/pages/admin/OwnerLeadsPage.tsx` | `px-4 md:px-8` |
| `src/pages/admin/ContactListsPage.tsx` | `px-4 md:px-8` |
| `src/pages/admin/ContactListDetailPage.tsx` | `px-4 md:px-8` |
| `src/pages/admin/MarketplaceUsersPage.tsx` | `px-4 md:px-8` |
| `src/pages/admin/TestingHub.tsx` | `px-4 md:px-8` |
| `src/pages/admin/remarketing/StandupTracker.tsx` | `px-4 md:px-8` |
| `src/pages/admin/remarketing/DailyTaskDashboard.tsx` | `px-4 md:px-8` |
| `src/components/admin/AdminNotificationBell.tsx` | Viewport-safe popover width |
| `src/pages/admin/MessageCenter.tsx` | Full-width thread list on mobile; responsive padding; compact view toggle |
| `src/components/admin/ListingsManagementTabs.tsx` | Shorter tab labels on mobile; reduced container padding |

## Implementation Order

1. Global `px-8` → `px-4 md:px-8` across all 10 admin page files
2. AdminNotificationBell popover width
3. MessageCenter thread list width + padding + view toggle
4. ListingsManagementTabs tabs + padding
5. AdminDashboard marketplace sub-tabs overflow

