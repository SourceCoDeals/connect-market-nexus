

# Phase 5-7: Complete Email Architecture Migration

## Current State — What the Investigation Proves

The code is working correctly. Brevo's API accepts every email (HTTP 201 with valid message IDs). But **no delivery webhook events have arrived from Brevo for today's emails** — meaning Brevo is either:
- Not delivering to Gmail (silent failure at SMTP level)
- Not sending webhook callbacks (webhook URL misconfigured in Brevo dashboard)

The last confirmed delivery webhook was April 2. Today: 7+ emails accepted by Brevo, zero delivery confirmations. The working emails from March 31 (verification, approval) were different email types without DOCX attachments.

## Critical Root Cause Hypothesis

The DOCX attachments on agreement emails may be causing Gmail to silently reject or quarantine them. The March 31 emails that worked had no attachments. This theory can be tested immediately by sending a plain-text agreement email without attachment.

## What Phases 5-7 Should Include

### Phase 5A — Diagnostic test (do first)
Send one agreement email **without** the DOCX attachment to isolate whether attachments are the delivery blocker. If it arrives, attachments are the problem and we switch to download links.

### Phase 5B — Migrate remaining 6 email families to `sendEmail()`
Convert these functions from `sendViaBervo()` to the new `sendEmail()` core:
- `send-connection-notification` (connection requests — the emails that used to work)
- `send-approval-email` (admin approvals)
- `user-journey-notifications` (onboarding journey)
- `send-user-notification` (generic notifications)
- `notify-deal-owner-change` (deal ownership)
- `enhanced-email-delivery` (admin custom emails)
- `notify-buyer-rejection`, `notify-buyer-new-message`, `notify-admin-new-message`

Each converts from `sendViaBervo({...})` to `sendEmail({...})` and gains the new `outbound_emails` tracking.

### Phase 5C — Replace attachment strategy
If Phase 5A confirms attachments block delivery:
- Upload NDA.docx / FeeAgreement.docx to public Supabase storage
- Generate signed download URLs
- Replace attachment with a "Download Document" button in the email HTML
- This matches the Lovable email infrastructure pattern (no attachment support)

### Phase 6 — Admin UI rebuild
- `DocumentTrackingPage.tsx` reads from `outbound_emails` + `email_events` exclusively
- Status badges: Queued → Accepted → Delivered → Opened (or Bounced/Blocked/Spam)
- Remove all references to legacy `email_delivery_logs` for status display
- Fix all hardcoded sender copy

### Phase 7 — Deletion
- Delete legacy `send-nda-email`, `send-fee-agreement-email` edge functions
- Delete `brevo-sender.ts` and `email-logger.ts` (replaced by `email-sender.ts`)
- Remove dead imports across all edge functions
- Clean up `email_delivery_logs` references (keep table for historical data, stop writing to it)

## User Action Required (Before Implementation)
1. Check Brevo dashboard → Transactional → Logs → search for message ID `202604031136.47859355396@smtp-relay.mailin.fr` to see Brevo's own delivery status
2. Check Brevo dashboard → Settings → Webhooks → confirm the webhook URL is `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/brevo-webhook`
3. Check Gmail **All Mail** folder (not just inbox/spam) for any emails from sourcecodeals.com today

## Files to Change
- `supabase/functions/_shared/email-sender.ts` (minor: add attachment-free mode)
- `supabase/functions/request-agreement-email/index.ts` (switch to download links if attachments fail)
- `supabase/functions/send-connection-notification/index.ts` → migrate to `sendEmail()`
- `supabase/functions/send-approval-email/index.ts` → migrate to `sendEmail()`
- `supabase/functions/user-journey-notifications/index.ts` → migrate to `sendEmail()`
- `supabase/functions/send-user-notification/index.ts` → migrate to `sendEmail()`
- `supabase/functions/notify-deal-owner-change/index.ts` → migrate to `sendEmail()`
- `supabase/functions/enhanced-email-delivery/index.ts` → migrate to `sendEmail()`
- `supabase/functions/notify-buyer-rejection/index.ts` → migrate to `sendEmail()`
- `supabase/functions/notify-buyer-new-message/index.ts` → migrate to `sendEmail()`
- `supabase/functions/notify-admin-new-message/index.ts` → migrate to `sendEmail()`
- `src/pages/admin/DocumentTrackingPage.tsx` (read from outbound_emails only)
- Delete: `send-nda-email`, `send-fee-agreement-email`, `brevo-sender.ts`, `email-logger.ts`

