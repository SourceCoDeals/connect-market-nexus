
# Fix Agreement Email Reliability and Add Real Delivery Visibility

## What I verified
- Both the **admin send** flow and the **buyer request/resend** flow are reaching the same edge function: `request-agreement-email`.
- Recent requests for `adambhaile00@gmail.com` are being written to `document_requests` as `email_sent`, and the function is returning **HTTP 200**.
- The sender is already coded correctly as **support@sourcecodeals.com** with reply-to set to the same address.
- The biggest gap: **agreement emails are not being written to `email_delivery_logs` at all**, so there is currently no durable audit trail showing:
  - whether Brevo accepted the send
  - the Brevo message id
  - any failure reason
  - which request row the email belongs to
- So right now the app can say “sent” without giving operations a trustworthy trace.

## Problems to fix
1. **No real delivery audit for agreement emails**
2. **No way to distinguish “request recorded” vs “provider accepted” vs “delivery/bounce issue”**
3. **Poor debug visibility in the edge function logs**
4. **Too many UI call sites invoke the function directly**, which makes regressions harder to catch
5. **Admin sends to manual/non-matched emails can be mis-attributed** to the acting admin in `document_requests.user_id`

## Plan
### 1. Harden the backend send flow
Update `supabase/functions/request-agreement-email/index.ts` so every send:
- generates a correlation id tied to the `document_requests` row
- logs a success/failure record to `email_delivery_logs`
- stores the Brevo `messageId` and any provider error text
- adds explicit structured logs for recipient, agreement type, request id, correlation id, and Brevo result

### 2. Separate request state from email delivery evidence
Keep the current business statuses in `firm_agreements` (`not_started` / `sent` / `signed`), but improve the ops trail in `document_requests` / delivery logs so admins can see:
- request created
- email accepted by provider
- email failed
- signed manually later

If needed, add lightweight columns for:
- `email_correlation_id`
- `email_provider_message_id`
- `last_email_error`

### 3. Add Brevo event tracking for true post-send verification
Add a Brevo webhook ingestion flow so the system can record downstream events like:
- delivered
- deferred
- bounced
- blocked
- spam complaint

That gives a real answer to “why didn’t it land in Gmail?” instead of only “the API call returned 200”.

### 4. Unify all frontend callers behind one helper
Create a single agreement-email client helper and move all UI surfaces to it:
- buyer request modal
- buyer resend from listing detail
- profile documents resend
- admin document tracking send/resend
- admin user tables / request actions

This helper should:
- use the existing reliable edge-function invoke utility
- preserve real backend error messages
- return structured success/failure
- centralize query invalidation

### 5. Fix admin recipient attribution
Adjust the admin-send path so manual recipients do **not** get attached to the acting admin as the target user.
Use recipient email + firm as canonical for admin-triggered requests when there is no matched platform user.

### 6. Improve the admin UI for trust and debugging
In the Document Tracking / agreement admin views, show:
- last email attempt time
- who triggered it
- provider acceptance/failure
- Brevo message id or correlation id
- latest failure reason, if any

This will make resend troubleshooting operationally usable.

## Files likely involved
- `supabase/functions/request-agreement-email/index.ts`
- `supabase/functions/_shared/email-logger.ts`
- `supabase/functions/_shared/brevo-sender.ts`
- `src/lib/invoke-edge-function.ts`
- `src/components/pandadoc/AgreementSigningModal.tsx`
- `src/components/listing-detail/ConnectionButton.tsx`
- `src/pages/Profile/ProfileDocuments.tsx`
- `src/components/admin/firm-agreements/AgreementStatusDropdown.tsx`
- `src/components/pandadoc/SendAgreementDialog.tsx`
- `src/pages/admin/DocumentTrackingPage.tsx`
- possibly a new Brevo webhook edge function + migration for audit metadata

## QA plan
1. Buyer requests NDA from listing
2. Buyer resends from listing detail
3. Buyer resends from Documents tab
4. Admin sends NDA from Document Tracking
5. Admin resends from status dropdown
6. Verify for each case:
   - `document_requests` row created/updated correctly
   - `email_delivery_logs` entry exists
   - correlation id links the two
   - Brevo message id is captured
   - UI reflects real send result
   - failures surface useful error copy
7. Then test one real inbox flow end-to-end with `adambhaile00@gmail.com`

## Technical note
The current code strongly suggests the function is being called successfully and Brevo is likely accepting the request, but the project lacks the instrumentation needed to prove inbox delivery. So the right fix is not just “retry harder” — it is to add **full send observability + webhook-based delivery tracking + unified client calls** so admin send and buyer resend become trustworthy and debuggable.
