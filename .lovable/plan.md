
Goal

Pin down the admin-documents agreement flow specifically, because that is the path you just tested.

What I found

1. No — this was not rebuilt end-to-end from scratch.
The admin-documents UI was rerouted to the newer `request-agreement-email` path, but the surrounding tracking/state model was not rebuilt with it.

2. Admin Documents is using the new function.
The resend in admin documents goes through:
- `src/components/admin/firm-agreements/AgreementStatusDropdown.tsx`
- `src/lib/agreement-email.ts`
- `supabase/functions/request-agreement-email/index.ts`

So for the issue you just tested, the main target is not the legacy NDA/Fee functions.

3. “Sent to provider” is a UI status, not proof of inbox delivery.
That label is shown when `document_requests.status === 'email_sent'`.
That status is set as soon as `request-agreement-email` gets a successful response back from `sendViaBervo()` and writes the row update.
So it means “accepted by the email API,” not “arrived in Gmail.”

4. There is a definite tracking bug in the admin queue.
The pending-request UI tries to match delivery webhook events using `email_correlation_id`.
But:
- `request-agreement-email` stores `email_correlation_id` as an app UUID
- `brevo-webhook` stores `correlation_id` as the normalized Brevo `message-id`
- `document_requests` already stores that provider id in `email_provider_message_id`
- the admin page ignores that field when looking up delivery events

Result: even if webhook events exist, the admin queue cannot map them back correctly, so it can stay stuck on “Sent to provider.”

5. The sender identity is still inconsistent in this path.
`request-agreement-email` uses:
- sender = `SENDER_EMAIL` or `support@sourcecodeals.com`
- reply-to = `adam.haile@sourcecodeals.com`

But your manual proof is specifically that sending as `adam.haile@sourcecodeals.com` works.
So this admin-documents path is still not explicitly locked to the identity you know works.

6. The UI copy is also misleading.
Several agreement screens hardcode `support@sourcecodeals.com` as the sender/inbox text, regardless of what the function is actually using.

What I would build next

1. Rebuild `request-agreement-email` as the single canonical admin agreement sender
Keep it as the only admin-documents send path, and stop treating delivery tracking as an afterthought.

2. Fix the identity model
Use one canonical provider-tracking key for the agreement flow:
- store normalized Brevo message-id
- use that same normalized provider id everywhere for webhook matching and UI state
- keep the app UUID only as an internal request correlation id

3. Fix the admin queue status model
Replace the current vague state flow with:
- Requested
- Accepted by provider
- Delivered
- Opened
- Bounced / Blocked / Spam
This will remove the false sense that “sent” means “delivered.”

4. Fix the join bug in `DocumentTrackingPage`
Change delivery lookup to use `email_provider_message_id` instead of `email_correlation_id`, with normalization on both sides.

5. Lock the sender identity for agreements
For this specific flow, I would stop relying on mixed fallback behavior and explicitly use the sender identity that you know works manually.
Given your evidence, that should be `adam.haile@sourcecodeals.com` unless you tell me otherwise.

6. Make the UI match reality
Update all agreement/admin copy that currently says support@ so the displayed sender/reply-to matches the actual configuration.

7. Add stronger diagnostics to the agreement sender
On every resend, log:
- resolved sender
- resolved reply-to
- recipient
- request row id
- provider message-id
- attachment names/sizes
- final status written to `document_requests`

Technical details

- Admin resend trigger:
  `src/components/admin/firm-agreements/AgreementStatusDropdown.tsx`
- Unified agreement sender:
  `supabase/functions/request-agreement-email/index.ts`
- Misleading pending badge:
  `src/pages/admin/DocumentTrackingPage.tsx`
- Shared mail sender:
  `supabase/functions/_shared/brevo-sender.ts`
- Webhook correlation logic:
  `supabase/functions/brevo-webhook/index.ts`

Most important conclusion

The biggest codebase-level issue I found is not “the click didn’t call the function.”
It is that the admin agreement flow currently mixes:
- one app correlation id
- one provider message id
- one sender identity in code
- different sender text in the UI

That means the flow is both hard to trust and hard to diagnose.
So the right move is not another small patch — it is to rebuild this one admin agreement path so sending, tracking, and UI all use the same truth model.
