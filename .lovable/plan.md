
# Listing Sidebar: Action Rows + Deal Inquiry Messaging

## What We're Building

Redesign the listing detail sidebar to include structured action rows (inspired by the reference screenshots), alongside the existing connection request flow:

1. **Explore Data Room** -- navigates to the data room section on the page. Enabled only when fee agreement is signed AND connection is approved.
2. **Ask a Question** -- opens an inline chat/message panel. Enabled when fee agreement is signed (no connection required).
3. **Tooltips on disabled rows** explaining what the buyer needs to do.
4. **"Viewed" timestamp** on data room row if they've accessed it before.
5. **Full messaging system** for questions: messages routed to admin Message Center, history preserved on both sides.

## Architecture Decision: Reuse connection_messages

Rather than creating a new table, we'll reuse the existing `connection_messages` + `connection_requests` infrastructure. When a buyer "asks a question" on a listing without a connection request, we auto-create a connection request with source `inquiry` (or reuse an existing one). This means:
- Admin Message Center already picks it up automatically
- Realtime subscriptions already work
- Email notifications (notify-admin-new-message) already fire
- Read receipts already work

## Database Changes

### Migration: Add `inquiry` to connection_requests source options
- No schema change needed -- `source` is already a text column, and `connection_requests` doesn't have a check constraint on it. We just use `source = 'inquiry'` when auto-creating.

## Files Changed

### 1. New Component: `src/components/listing-detail/ListingSidebarActions.tsx`

The "Interested?" action card with rows:

```
Explore data room          >    (enabled if fee_covered + approved connection)
Ask a question             >    (enabled if fee_covered)
Request a connection       >    (existing ConnectionButton logic)
```

Each row: icon on left, label, chevron on right. Disabled rows are greyed out with a tooltip explaining the requirement.

If "Explore data room" was viewed before, show "Viewed [date]" subtitle (query `data_room_access` for the user's last access).

If "Ask a question" is clicked, expand an inline message input below the row (or open a small chat panel). Messages are sent via `useSendMessage` with `sender_role: 'buyer'`.

### 2. New Hook: `src/hooks/marketplace/use-deal-inquiry.ts`

- `useDealInquiry(listingId)`: finds or creates a connection_request for the current user + listing with `source = 'inquiry'`, `status = 'pending'`.
- Returns the `connection_request_id` so messages can be sent against it.
- If a real connection request already exists for this listing, reuse that one (no duplicate).

### 3. Update: `src/pages/ListingDetail.tsx`

- Replace the current sidebar card (lines 330-374) with `ListingSidebarActions` component that includes:
  - The new action rows (data room, ask question)
  - The existing `ConnectionButton` (for requesting connections)
  - The existing `EnhancedSaveButton`
- Pass agreement coverage, connection status, and listing info as props.

### 4. Update: `src/components/listing-detail/ConnectionButton.tsx`

- No major changes. It stays as-is inside the sidebar actions component. The agreement gate / document signing UI remains in ConnectionButton.

### 5. Buyer-side message history

- When "Ask a question" is active, show the message thread inline using `useConnectionMessages(inquiryRequestId)`.
- Buyer can see all past messages and send new ones.
- Messages are marked read via `useMarkMessagesReadByBuyer`.

### 6. Admin side

- No changes needed. The auto-created inquiry connection request appears in the admin Message Center automatically. The `source: 'inquiry'` field lets admins distinguish inquiry-only threads from full connection requests.
- The thread will show the listing title and buyer info as usual.

## Sidebar Layout (from top to bottom)

```text
┌──────────────────────────────────┐
│  Request Access to This Deal     │
│  (existing description copy)     │
│                                  │
│  ┌────────────────────────────┐  │
│  │ ◇ Explore data room     > │  │  (or greyed + tooltip)
│  │   Viewed Nov 19, 2025      │  │  (if viewed before)
│  ├────────────────────────────┤  │
│  │ ? Ask a question        > │  │  (or greyed + tooltip)
│  ├────────────────────────────┤  │
│  │ [ConnectionButton]         │  │  (existing component)
│  ├────────────────────────────┤  │
│  │ [Save] [Share]             │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

## Tooltip Text (when disabled)

- **Data Room (no fee agreement)**: "Sign your Fee Agreement to unlock the data room."
- **Data Room (fee signed but no approved connection)**: "Request a connection to access the data room."
- **Ask a Question (no fee agreement)**: "Sign your Fee Agreement to ask questions about this deal."

## Files Summary

| File | Action |
|---|---|
| `src/components/listing-detail/ListingSidebarActions.tsx` | New -- action rows with gating/tooltips |
| `src/hooks/marketplace/use-deal-inquiry.ts` | New -- find/create inquiry connection request |
| `src/pages/ListingDetail.tsx` | Update sidebar to use new component |
| `src/components/listing-detail/ConnectionButton.tsx` | Minor -- stays as-is, embedded in new layout |

No new database tables. No new edge functions. No migrations needed (source is a free-text column).
