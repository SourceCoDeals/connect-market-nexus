

# Fix Email Delivery — Root Causes Identified

## Investigation Results

### What's actually happening
I tested end-to-end and found three distinct problems:

### Problem 1: Brevo webhook is blocked (no delivery tracking)
**`brevo-webhook` is missing from `supabase/config.toml`**. Without an explicit `verify_jwt = false` entry, Supabase defaults to requiring JWT authentication. Since Brevo sends webhooks without a JWT, every webhook call is rejected at the gateway with a 401 — before your code ever runs. This is why there are zero webhook logs and zero delivery confirmations.

### Problem 2: Emails accepted by Brevo but not reaching inbox
The function is working correctly — today's test at 09:45 UTC returned HTTP 200, Brevo returned a message ID (`<202604030945.84272144271@smtp-relay.mailin.fr>`), and the database recorded `email_sent`. But the email never arrives. This points to a **Brevo sender verification issue**: the sender `notifications@sourcecodeals.com` may not be properly authenticated in Brevo (no verified domain or sender identity for that address).

There is no `SENDER_EMAIL` secret configured, so ALL email functions (agreement, connection notification, approval, journey) fall back to `notifications@sourcecodeals.com`. If that address isn't verified in Brevo, all emails silently fail after acceptance.

### Problem 3: Missing config entries for webhook and data room functions  
`brevo-webhook` and `grant-data-room-access` are not in `config.toml`, meaning they require JWT and will fail when called externally.

## Plan

### Step 1: Add `brevo-webhook` and `grant-data-room-access` to config.toml
Add `verify_jwt = false` entries for both functions so Brevo's webhook calls and data room access requests are not blocked at the gateway.

### Step 2: Add `SENDER_EMAIL` secret
Add the secret `SENDER_EMAIL` with value `adam.haile@sourcecodeals.com` (or whatever verified sender is configured in Brevo). This is the sender address that the connection notifications and other previously-working emails used. Without this secret, every email function defaults to `notifications@sourcecodeals.com` which appears to not be deliverable.

### Step 3: Redeploy affected functions
Redeploy `brevo-webhook`, `request-agreement-email`, `send-connection-notification`, `send-approval-email`, and `user-journey-notifications` so they pick up the config changes and can use the new secret.

### Step 4: Verify end-to-end
Test a resend and confirm:
- Edge function returns 200
- Email arrives in inbox
- Brevo webhook fires and is received (delivery status updates in admin UI)

## Files Changed
- `supabase/config.toml` — Add `brevo-webhook` and `grant-data-room-access` with `verify_jwt = false`

## User Action Required
You need to verify in your Brevo dashboard (Settings → Senders & IPs → Senders) which sender email address is actually verified. The secret should match that verified sender. If `adam.haile@sourcecodeals.com` is verified there, that's what we use. If `support@sourcecodeals.com` is verified, we use that instead.

