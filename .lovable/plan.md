

# Implement Deal Owner Sender Selection + Exact Email Preview

## Summary

Upgrade the `ConnectionRequestEmailDialog` to show the **exact email body** (matching what the edge functions send) and add a **sender dropdown** so admins can send approval/rejection emails from their own `@sourcecodeals.com` address. Add Brandon and Alia to admin profiles. Update edge functions to accept sender overrides. Wire sender selection through action handlers.

**Brevo: No action needed.** Your domain `sourcecodeals.com` is already authenticated. Any `@sourcecodeals.com` address works as sender immediately.

## Plan

### 1. Add Brandon & Alia to `src/lib/admin-profiles.ts`

```
brandon.hall@sourcecodeals.com → Brandon Hall
alia.ballout@sourcecodeals.com → Alia Ballout
```

Add a new exported constant `DEAL_OWNER_SENDERS` -- array of `{ email, name, title }` for the sender dropdown:
- `support@sourcecodeals.com` (SourceCo Support) -- default
- `bill.martin@sourcecodeals.com` (Bill Martin)
- `alia.ballout@sourcecodeals.com` (Alia Ballout)
- `brandon.hall@sourcecodeals.com` (Brandon Hall)

### 2. Upgrade `ConnectionRequestEmailDialog.tsx` -- exact email body + sender selector

Replace bullet-point summaries with the **actual email text** that matches the edge functions:

**Approval preview** (mirrors `send-connection-notification` approval_notification):
- "Your introduction to [Deal Title] has been approved."
- "We are making a direct introduction to the business owner..."
- Bullet list of next steps
- "This is an exclusive introduction..."
- CTA: "View Messages"

**Rejection preview** (mirrors `notify-buyer-rejection`):
- "Thank you for your interest in [Deal Title]."
- "After reviewing your profile against this specific opportunity..."
- "Your interest has been noted..."
- "In the meantime, continue browsing..."

Add a `<Select>` dropdown at the top: **"From:"** with the `DEAL_OWNER_SENDERS` list. Selected value is passed to `onConfirm` as `senderEmail`.

Update `onConfirm` signature: `(comment: string, senderEmail: string) => Promise<void>`

### 3. Update `useConnectionRequestActions.ts` -- pass sender to edge functions

Update `handleAccept` and `handleReject` to accept an optional `senderEmail` parameter.

For **approvals** (`send-connection-notification`): pass `senderEmail`, `senderName`, `replyTo` in the request body.

For **rejections** (`notify-buyer-rejection`): pass `senderEmail`, `senderName`, `replyTo` in the request body.

### 4. Update `connection-request-actions/index.tsx` -- forward sender

Update `handleEmailDialogConfirm` to pass the sender email from the dialog through to `handleAccept`/`handleReject`.

### 5. Update `WebflowLeadDetail.tsx` -- same forwarding

Pass sender selection through the email dialog to the action handlers.

### 6. Update edge functions to accept sender overrides

**`send-connection-notification/index.ts`** (approval_notification branch):
- Accept optional `senderEmail`, `senderName`, `replyTo` in request body
- Pass to `sendEmail()` call, falling back to current defaults

**`notify-buyer-rejection/index.ts`**:
- Accept optional `senderEmail`, `senderName`, `replyTo` in request body
- Pass to `sendEmail()` call, falling back to current defaults

### 7. Deploy edge functions

Deploy both `send-connection-notification` and `notify-buyer-rejection`.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/admin-profiles.ts` | Add Brandon & Alia, add `DEAL_OWNER_SENDERS` |
| `src/components/admin/ConnectionRequestEmailDialog.tsx` | Exact email body preview + sender dropdown |
| `src/components/admin/connection-request-actions/useConnectionRequestActions.ts` | Accept + forward `senderEmail` param |
| `src/components/admin/connection-request-actions/index.tsx` | Pass sender from dialog to handlers |
| `src/components/admin/WebflowLeadDetail.tsx` | Pass sender from dialog to handlers |
| `supabase/functions/send-connection-notification/index.ts` | Accept sender overrides |
| `supabase/functions/notify-buyer-rejection/index.ts` | Accept sender overrides |

