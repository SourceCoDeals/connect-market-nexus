

# Fix: Reliable Email Delivery for All Admin Senders

## Root Cause

Brevo confirms delivery for all senders, but Gmail's per-sender reputation scoring routes unfamiliar sender addresses to spam. `adam.haile@sourcecodeals.com` has established reputation; other admin addresses do not.

## Solution: Use a Single Verified Sender + Reply-To

Always send from a single known-good address (`noreply@sourcecodeals.com`) and put the admin's name in the display name with their email in Reply-To. This ensures consistent inbox placement while preserving the personal touch.

**What the recipient sees:**
- From: `Bill Martin via SourceCo <noreply@sourcecodeals.com>`
- Reply-To: `bill.martin@sourcecodeals.com`
- Hitting "Reply" goes to Bill's actual email

## Files to Change

### 1. `supabase/functions/_shared/email-sender.ts`
- Change line 146: Always use `VERIFIED_SENDER_EMAIL` (`support@sourcecodeals.com`) or `NOREPLY_SENDER_EMAIL` as the actual `sender.email` in the Brevo payload
- Move the admin's email to `replyTo` only
- Incorporate admin name into sender display name: `"Bill Martin via SourceCo"`
- Keep `senderEmail` in `outbound_emails` record for tracking, but don't use it as the Brevo `sender.email`

### 2. `supabase/functions/send-connection-notification/index.ts`
- No changes needed -- it already passes `senderEmail`/`senderName`/`replyTo` to `sendEmail()`. The sender lockdown happens in the shared layer.

### 3. `supabase/functions/notify-buyer-rejection/index.ts`
- Same as above -- no changes needed.

### 4. Redeploy both edge functions + shared code
- Redeploy `send-connection-notification` and `notify-buyer-rejection` to pick up the shared email-sender change.

## Key Detail in email-sender.ts

```typescript
// Current (line 145-146):
sender: { name: senderName, email: senderEmail },

// New:
const isCustomSender = options.senderEmail && options.senderEmail !== VERIFIED_SENDER_EMAIL;
const displayName = isCustomSender ? `${senderName} via SourceCo` : senderName;
sender: { name: displayName, email: NOREPLY_SENDER_EMAIL },
```

The `replyTo` field already works correctly (line 156). The admin's email stays as Reply-To so recipients can reply directly to the admin.

## What This Means for Users

- All emails arrive from `noreply@sourcecodeals.com` (established reputation)
- The "From" name shows the admin's name (e.g., "Bill Martin via SourceCo")
- Hitting Reply goes to the admin's actual email address
- Consistent inbox delivery regardless of which admin sends

