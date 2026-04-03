

# Add SENDER_EMAIL Secret + Redeploy All Email Functions

## Root Cause (confirmed)

`SENDER_EMAIL` is **not configured** as a secret. Every email function falls back to `notifications@sourcecodeals.com`, which is not a verified sender in Brevo. The user confirmed `support@sourcecodeals.com` IS verified in Brevo.

This affects ALL email sending — not just agreements, but connection notifications, approvals, rejections, and every other email flow.

## Plan

### Step 1: Add the `SENDER_EMAIL` secret
Set `SENDER_EMAIL` to `support@sourcecodeals.com` (the verified Brevo sender).

### Step 2: Redeploy all email-sending edge functions
So they pick up the new secret. Functions affected:
- `request-agreement-email`
- `send-connection-notification`
- `send-approval-email`
- `user-journey-notifications`
- `brevo-webhook`
- `notify-buyer-rejection`
- `notify-buyer-new-message`
- `notify-admin-new-message`
- `enhanced-email-delivery`

### Step 3: Test with curl
Send a test agreement email to verify it reaches `adambhaile00@gmail.com`.

## No Code Changes
All code already reads `SENDER_EMAIL` from env. Only the secret needs to be added.

