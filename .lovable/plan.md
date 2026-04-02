

# Fix Agreement Emails — Redeploy Edge Function

## Problem
The `request-agreement-email` edge function was NOT successfully redeployed earlier. Evidence:
- All `document_requests` rows have `email_correlation_id: NULL` and `email_provider_message_id: NULL` — the new tracking code never ran
- Zero logs exist for this function
- `email_delivery_logs` has no agreement email entries (only older approval/journey emails from March 31)

The code in the repository is correct and complete. The deployed version is stale.

## Fix
Redeploy `request-agreement-email` (and the shared dependencies it imports: `brevo-sender.ts`, `email-logger.ts`, `auth.ts`, `cors.ts`, `firm-self-heal.ts`).

This is the only action needed. Once deployed, the next time you or a user triggers a resend:
1. Brevo will receive the send request with `support@sourcecodeals.com` as sender
2. `email_delivery_logs` will get an entry with correlation ID
3. `document_requests` will get `email_correlation_id` and `email_provider_message_id` populated
4. The Brevo webhook you just set up will track delivery/bounce events

## Verification After Deploy
After redeploying, trigger one resend from the listing detail screen. Then check:
- `email_delivery_logs` for a new `agreement_nda` or `agreement_fee_agreement` entry
- `document_requests` for a row with non-null `email_correlation_id`
- Your inbox at `adambhaile00@gmail.com` for the actual email

## Files Changed
None — code is already correct. Only deployment action needed.
