

# Remaining Work: Admin Email Preview + Edit for Connection Requests

## Current State

The email preview dialog, sender dropdown, and edge function sender overrides are all wired up. Three gaps remain:

1. **Auto-select logged-in admin as default sender** -- Currently always defaults to support@sourcecodeals.com regardless of who's logged in
2. **WebflowLeadDetail doesn't send emails** -- The Webflow lead approve/reject path only updates status; it never invokes the edge functions to send emails. The sender email from the dialog is discarded.
3. **Email body is not editable** -- The preview is read-only. You asked for the ability to edit the email and send a modified version.

## Plan

### 1. Auto-select logged-in admin's sender email

In `ConnectionRequestEmailDialog.tsx`:
- Accept the current user's email (from `useAuth`) 
- On dialog open, check if the logged-in admin's email matches any `DEAL_OWNER_SENDERS` entry
- If yes, default the dropdown to their email instead of support@
- If no match, keep support@ as default

### 2. Fix WebflowLeadDetail to actually send emails

In `WebflowLeadDetail.tsx`:
- Replace `handleAcceptDirect` / `handleRejectDirect` with proper logic that mirrors `useConnectionRequestActions` -- i.e., after updating status, invoke `send-connection-notification` (for approvals) and `notify-buyer-rejection` (for rejections) with the selected sender
- Pass the `senderEmail` from the dialog through to these edge function calls

### 3. Make email body editable in the dialog

In `ConnectionRequestEmailDialog.tsx`:
- Replace the read-only email body preview with a `<Textarea>` pre-filled with the email text (plain text version of what would be sent)
- Track edited body in state
- Pass the edited body through `onConfirm` as a new parameter: `(comment, senderEmail, customBody?) => Promise<void>`

### 4. Update edge functions to accept a custom body override

In both `send-connection-notification` and `notify-buyer-rejection`:
- Accept an optional `customBodyHtml` or `customBodyText` field
- If provided, use it instead of the default template HTML (wrap it in the standard email template wrapper)
- If not provided, use the existing template (backward compatible)

### 5. Wire custom body through action handlers

In `useConnectionRequestActions.ts`:
- Update `handleAccept` and `handleReject` to accept and forward `customBody`
- Pass it to the edge function invocation body

In `connection-request-actions/index.tsx` and `WebflowLeadDetail.tsx`:
- Forward the custom body from the dialog's `onConfirm` callback

## Files Changed

| File | Change |
|------|--------|
| `src/components/admin/ConnectionRequestEmailDialog.tsx` | Auto-select admin sender, make body editable, pass customBody in onConfirm |
| `src/components/admin/WebflowLeadDetail.tsx` | Send actual emails on approve/reject with sender + custom body |
| `src/components/admin/connection-request-actions/useConnectionRequestActions.ts` | Accept + forward customBody to edge functions |
| `src/components/admin/connection-request-actions/index.tsx` | Forward customBody from dialog |
| `supabase/functions/send-connection-notification/index.ts` | Accept optional customBodyHtml override |
| `supabase/functions/notify-buyer-rejection/index.ts` | Accept optional customBodyHtml override |

## Brevo / External Steps

**None required.** Your domain `sourcecodeals.com` is already authenticated. Bill, Alia, and Brandon's `@sourcecodeals.com` addresses work as senders immediately.

## Edge Function Deployment

Both `send-connection-notification` and `notify-buyer-rejection` need redeployment after the custom body override is added.

