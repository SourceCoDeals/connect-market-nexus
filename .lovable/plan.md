

# Send Admin Notification Emails to support@sourcecodeals.com

## Problem

When buyers send messages or request documents, admins only get in-app notifications (realtime toasts + dashboard). There is no email going to the shared support inbox, so admins have to be logged in to notice activity.

## Solution

Create a lightweight edge function `notify-support-inbox` that sends a simple notification email to `support@sourcecodeals.com` for three event types:

1. **Buyer sends a message** (new message or reply)
2. **Buyer requests document signing** (NDA/Fee Agreement)
3. **Admin replies to a buyer** (so other admins see the activity)

This is a single email to one inbox -- not per-admin emails. Admins monitor `support@sourcecodeals.com` in Outlook and see everything there.

## Changes

### 1. New edge function: `supabase/functions/notify-support-inbox/index.ts`

A simple function that accepts a notification type and context, then sends one email to `support@sourcecodeals.com`:

- **Input**: `{ type: 'new_message' | 'document_request' | 'admin_reply', buyerName, dealTitle?, messagePreview?, documentType? }`
- **Email**: Minimal branded email with the relevant details and a link to the admin dashboard (message center or document tracking)
- Uses existing `sendEmail` + `wrapEmailHtml` infrastructure
- Subject lines:
  - New message: "New Message from [Buyer] re: [Deal]"
  - Document request: "[Buyer] requested [NDA/Fee Agreement]"
  - Admin reply: "[Admin] replied to [Buyer] re: [Deal]"

### 2. Wire up triggers

**`src/hooks/use-connection-messages.ts`** (useSendMessage):
- After buyer message insert (around line 157): invoke `notify-support-inbox` with type `new_message`
- After admin message (after `notify-buyer-new-message` call): also invoke `notify-support-inbox` with type `admin_reply`

**`src/pages/BuyerMessages/GeneralChatView.tsx`**:
- After buyer sends general message (around line 143): invoke `notify-support-inbox` with type `new_message`

**`src/components/listing-detail/ListingSidebarActions.tsx`**:
- After document request is sent: invoke `notify-support-inbox` with type `document_request`

All invocations are fire-and-forget (non-blocking).

### 3. Add to config.toml

Add `notify-support-inbox` with `verify_jwt = false` (uses in-code auth validation).

### Files changed
- `supabase/functions/notify-support-inbox/index.ts` -- new edge function
- `supabase/config.toml` -- add function entry
- `src/hooks/use-connection-messages.ts` -- add invocations for buyer messages and admin replies
- `src/pages/BuyerMessages/GeneralChatView.tsx` -- add invocation for general chat messages
- `src/components/listing-detail/ListingSidebarActions.tsx` -- add invocation for document requests

