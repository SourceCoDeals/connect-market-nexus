
Root cause analysis so far:

- The resend is reaching the live edge function successfully.
- The function is returning success from Brevo.
- The database is recording the send as successful.
- The likely failure point is now after Brevo accepts the message: delivery, inbox placement, or webhook observability.

What I verified

1. Latest resend worked technically
- `request-agreement-email` logged:
  - `SUCCESS | recipient=adambhaile00@gmail.com`
  - Brevo message id: `<202604022031.78436361084@smtp-relay.mailin.fr>`
- `document_requests` now stores:
  - `status = email_sent`
  - non-null `email_correlation_id`
  - non-null `email_provider_message_id`
- `email_delivery_logs` has a new row:
  - `email_type = agreement_nda`
  - `status = sent`

2. This means the app is not the current blocker
The user resend flow, the admin-triggered agreement send path, the edge function auth, the Brevo API call, and the database logging are all working for the latest resend.

3. Biggest gap: no delivery webhook evidence
- `brevo-webhook` has no logs for this email.
- That means one of these is true:
  - Brevo has not fired a delivery/open/bounce event yet
  - the webhook is not being hit
  - Brevo accepted the message but did not actually deliver it
  - the email is being silently filtered/quarantined before inbox

What this means
The current issue is no longer “resend button broken.”
It is now “Brevo accepted the email, but we do not yet have proof of delivered/bounced/blocked.”

Implementation plan

1. Harden delivery observability
- Improve agreement email logging so every send stores:
  - recipient
  - correlation id
  - Brevo provider message id
  - sender used
  - subject used
- Ensure the admin UI can surface:
  - Sent to Brevo
  - Delivered
  - Bounced / Blocked / Complaint
  - No provider callback yet

2. Fix webhook correlation reliability
- Review the webhook matching logic and make sure Brevo webhook payload `message-id` format matches exactly what we store in `document_requests.email_provider_message_id`
- If needed, normalize message ids before comparing
- Log raw webhook identifiers for debugging
- Make sure delivery events update both:
  - `email_delivery_logs`
  - `document_requests.last_email_error` / delivery state

3. Verify webhook coverage end-to-end
- Confirm the webhook handler supports the actual Brevo event names you enabled:
  - delivered
  - opened
  - clicked
  - hard bounce
  - soft bounce
  - blocked
  - complaint / spam
  - unsubscribed
- Add explicit handling for both naming variants where needed (`hardBounce` vs `hard_bounce`, etc.)
- Add stronger logging for unrecognized events instead of silently ignoring them

4. Add a clear delivery state in admin Document Tracking
- Show a per-request mail state:
  - Sent to provider
  - Delivered
  - Opened
  - Bounced / Blocked / Complaint
  - Unknown / awaiting callback
- This prevents the team from assuming “email_sent” means “in inbox”

5. Audit all agreement-related send entry points
Unify and verify these all hit the same helper and same live function:
- buyer request in listing detail
- buyer request modal
- admin resend/send from Document Tracking
- any legacy NDA / Fee Agreement send buttons still calling old functions

6. Check for legacy paths still in the codebase
There are still older direct Brevo agreement functions in the repo:
- `send-nda-email`
- `send-fee-agreement-email`
These need to be audited so agreement sending is not split across old and new paths. If any UI still uses them, route everything through the unified `request-agreement-email` flow.

Most likely root cause
Based on the evidence, the most likely root cause is:
- Brevo is accepting the agreement email request, but the email is not reaching inbox and the webhook is not yet confirming delivery.
So the remaining work should focus on provider-level observability and webhook-backed status, not on the resend UI itself.

Technical details
- Live function version handling the successful resend: `request-agreement-email` version 17
- Latest successful request:
  - status code `200`
  - execution time ~1494 ms
- Latest stored provider message id:
  - `<202604022031.78436361084@smtp-relay.mailin.fr>`
- Webhook code currently logs delivery events into `email_delivery_logs` with `email_type = brevo_webhook`, but there is no confirmed event yet for this message
- The current data model distinguishes:
  - app send accepted: `email_delivery_logs.status = sent`
  - provider delivery result: webhook-driven follow-up event

Next implementation pass
I would focus the next build on:
1. stronger webhook logging + message-id normalization
2. explicit delivery-state UI in admin documents
3. removing any remaining legacy agreement send paths
4. surfacing “accepted by Brevo but not yet delivered” clearly on both admin and user side
