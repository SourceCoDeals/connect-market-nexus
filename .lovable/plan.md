

# Fix: Separate notification badges for "My Deals" vs "Messages"

## Problem
When an admin messages a buyer, the unread count appears in **both** the "My Deals" and "Messages" nav badges. The user wants:
- **Messages tab** — only general inquiry threads (linked to the internal listing `00000000-0000-0000-0000-000000000001`)
- **My Deals tab** — only deal-related threads (all other listings)

## Root Cause
`useUnreadBuyerMessageCounts` returns a single `total` across all connection requests. Both `DesktopNavItems` and `MobileNavItems` use this same total for the Messages badge, and also add it into the My Deals badge.

## Plan

### 1. Update `useUnreadBuyerMessageCounts` (src/hooks/use-connection-messages.ts)
- Fetch `connection_requests` with `id` AND `listing_id` (instead of just `id`)
- After counting unread messages per request, split them into two totals:
  - `dealTotal` — requests where `listing_id !== GENERAL_INQUIRY_LISTING_ID`
  - `messagesTotal` — requests where `listing_id === GENERAL_INQUIRY_LISTING_ID`
- Return `{ byRequest, total, dealTotal, messagesTotal }`

### 2. Update DesktopNavItems (src/components/navbar/DesktopNavItems.tsx)
- My Deals badge: use `unreadCount` (notifications) + `unreadMessages?.dealTotal` instead of `unreadMessages?.total`
- Messages badge: use `unreadMessages?.messagesTotal` instead of `unreadMessages?.total`

### 3. Update MobileNavItems (src/components/navbar/MobileNavItems.tsx)
- Same split as desktop

### Files to edit
- `src/hooks/use-connection-messages.ts` — split unread counts by listing type
- `src/components/navbar/DesktopNavItems.tsx` — use split counts
- `src/components/navbar/MobileNavItems.tsx` — use split counts

