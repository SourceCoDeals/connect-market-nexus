

# Fix: False Message Notifications on Empty Threads

## Problem

Three places count `decision` and `system` type messages (auto-generated approval messages) as "unread," causing badges and dots to appear even when the user sees "No messages yet":

1. **My Deals detail panel** — "Messages" tab shows a gold dot (line 375 in MyRequests.tsx) driven by unread count that includes decision messages, but the message view filters them out (line 24-26 in DealMessagesTab.tsx), so user sees "No messages yet" with an unread indicator.

2. **Navbar "My Deals" badge** — `useUnreadBuyerMessageCounts` counts decision messages AND has a secondary loop that counts any thread where `last_message_sender_role === 'buyer'` as needing a notification, even if no real conversation has started.

3. **Buyer Messages thread list** — `useBuyerThreads` query counts all admin-sent unread messages including decision/system types.

## Root Cause

The unread count queries don't exclude `message_type IN ('decision', 'system')` messages, but every display component filters them out. The user sees "no messages" with a badge saying there are unread messages.

## Fix

### File 1: `src/hooks/use-connection-messages.ts`

**`useUnreadBuyerMessageCounts` (line 300-305):**
- Add `.not('message_type', 'in', '("decision","system")')` to the unread messages query so decision/system messages don't count toward badges.

**Secondary "awaiting reply" loop (lines 326-337):**
- Remove this entire block. It inflates badges for threads where the buyer sent the initial connection request message but no real conversation has started. The buyer doesn't need a notification for their own message.

### File 2: `src/pages/BuyerMessages/useMessagesData.ts`

**`useBuyerThreads` unread query (lines 84-90):**
- Add `.not('message_type', 'in', '("decision","system")')` to exclude auto-generated messages from unread counts.

## Result

- Navbar badges only count real human-sent admin messages
- "Messages" tab dot in My Deals only appears when there are actual visible unread messages
- No more "No messages yet" with a notification dot

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/use-connection-messages.ts` | Exclude decision/system from unread count query; remove "awaiting reply" inflation loop |
| `src/pages/BuyerMessages/useMessagesData.ts` | Exclude decision/system from thread unread count query |

Two files, surgical query changes. No UI or database changes needed.

