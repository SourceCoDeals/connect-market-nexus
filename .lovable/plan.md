

# Send Marketplace Approval Email from adam.haile@sourcecodeals.com

## Problem

All emails currently send from `support@sourcecodeals.com` because `email-sender.ts` hardcodes the sender email with no override. The marketplace access approval email ("Project X: Investment Opportunity") needs to come from `adam.haile@sourcecodeals.com` as it did before.

## Changes

### 1. `supabase/functions/_shared/email-sender.ts`

Add an optional `senderEmail` field to the `SendEmailOptions` interface. When provided, use it instead of `VERIFIED_SENDER_EMAIL`. This keeps the default as `support@` for all other emails but allows specific emails to override.

```typescript
// Add to SendEmailOptions:
senderEmail?: string;

// Line 103 changes from:
const senderEmail = VERIFIED_SENDER_EMAIL;
// To:
const senderEmail = options.senderEmail || VERIFIED_SENDER_EMAIL;
```

### 2. `supabase/functions/approve-marketplace-buyer/index.ts`

Add `senderEmail: 'adam.haile@sourcecodeals.com'` and update `senderName` to `'Adam Haile'` in the `sendEmail` call. Update `replyTo` to `'adam.haile@sourcecodeals.com'` as well.

### 3. `src/components/admin/emails/AdminEmailRouting.tsx`

Update the "Marketplace Access Approved" entry to reflect `adam.haile@sourcecodeals.com` as the sender instead of `support@`.

### 4. Deploy

Deploy `approve-marketplace-buyer` edge function.

### Files changed
- `supabase/functions/_shared/email-sender.ts` — add optional `senderEmail` field
- `supabase/functions/approve-marketplace-buyer/index.ts` — use adam.haile sender
- `src/components/admin/emails/AdminEmailRouting.tsx` — update dashboard entry

