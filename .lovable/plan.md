

# Stop Admin Emails + Change Sender to support@sourcecodeals.com

## Two Requirements

1. **No individual admin gets any notification email from the platform.** All platform notifications (messages, connection requests, feedback, new users, document signings) go ONLY to `support@sourcecodeals.com`.

2. **Sender identity must be `support@sourcecodeals.com`**, not `adam.haile@sourcecodeals.com`. Every platform email (including buyer-facing) should come from `support@sourcecodeals.com` with sender name "SourceCo".

## Important Caveat: Brevo Verified Sender

The platform uses Brevo (Sendinblue) to send emails. Brevo requires the FROM address to be a verified sender. Currently `adam.haile@sourcecodeals.com` is the verified sender. Before we can change the FROM to `support@sourcecodeals.com`, that address must be verified in Brevo. If it's not verified, Brevo will reject all sends.

**Recommendation**: We change the locked sender to `support@sourcecodeals.com` in the code. You'll need to verify `support@sourcecodeals.com` as a sender in your Brevo account. If it's already verified, this will work immediately. If not, we should verify it first. We'll proceed with the code changes assuming it can be verified.

## Edge Functions That Email Individual Admins (must change to support@ only)

### 1. `send-connection-notification` (lines 158-193)
- Currently: loops through ALL admins via `user_roles` query, sends to each
- Fix: Replace the admin loop with a single send to `support@sourcecodeals.com`

### 2. `send-feedback-notification` (lines 28-76)
- Currently: queries `profiles.is_admin`, loops through all admins
- Fix: Send only to `support@sourcecodeals.com`

### 3. `user-journey-notifications` (lines 157-197)
- Currently: on `user_created`, loops through all admin profiles
- Fix: Send only to `support@sourcecodeals.com`

### 4. `enhanced-admin-notification` (line 52)
- Currently: sends to `ADMIN_NOTIFICATION_EMAIL` env var (fallback: `admin@sourcecodeals.com`)
- Fix: Hardcode to `support@sourcecodeals.com`, ignore env var

### 5. `admin-digest` (line 204)
- Currently: sends to `ADMIN_NOTIFICATION_EMAILS` env var (fallback: `adam.haile@sourcecodeals.com`)
- Fix: Send only to `support@sourcecodeals.com`

### 6. `notify-remarketing-match`
- Currently: queries `profiles.is_admin` for admin recipients
- Fix: Send only to `support@sourcecodeals.com`

## Sender Identity Change

### `_shared/email-sender.ts` (lines 15-17)
- Change `VERIFIED_SENDER_EMAIL` from `adam.haile@sourcecodeals.com` to `support@sourcecodeals.com`
- Change `VERIFIED_SENDER_NAME` from `Adam Haile - SourceCo` to `SourceCo`
- Change `DEFAULT_REPLY_TO` from `adam.haile@sourcecodeals.com` to `support@sourcecodeals.com`

### Hardcoded `adam.haile` references in other functions
- `send-feedback-notification` line 70: replyTo change to `support@`
- `send-feedback-email` line 61: replyTo change to `support@`
- `send-simple-verification-email` lines 71-87: change signature and replyTo
- `send-user-notification` line 58: change contact email reference
- `send-owner-inquiry-notification` line 63: change fallback to `support@`
- `user-journey-notifications` line 60: change contact email in rejection copy

## Update Admin Email Routing Component

### `src/components/admin/emails/AdminEmailRouting.tsx`
- Update all routing entries to reflect that every admin notification goes to `support@sourcecodeals.com`
- Remove "All admins" recipient entries
- Update sender identity references

## Files Changed
- `supabase/functions/_shared/email-sender.ts` -- change sender identity
- `supabase/functions/send-connection-notification/index.ts` -- send to support@ only
- `supabase/functions/send-feedback-notification/index.ts` -- send to support@ only
- `supabase/functions/user-journey-notifications/index.ts` -- send to support@ only
- `supabase/functions/enhanced-admin-notification/index.ts` -- send to support@ only
- `supabase/functions/admin-digest/index.ts` -- send to support@ only
- `supabase/functions/notify-remarketing-match/index.ts` -- send to support@ only
- `supabase/functions/send-feedback-email/index.ts` -- update replyTo
- `supabase/functions/send-simple-verification-email/index.ts` -- update signature/replyTo
- `supabase/functions/send-user-notification/index.ts` -- update contact email
- `supabase/functions/send-owner-inquiry-notification/index.ts` -- update fallback
- `src/components/admin/emails/AdminEmailRouting.tsx` -- update routing display
- Deploy all updated edge functions

