

# Revamp Document Signing: Email-Based NDA & Fee Agreement Workflow

## Summary

Replace the PandaDoc embedded signing system with a simple email-based workflow. Buyers click "Request NDA" or "Request Fee Agreement" buttons, which sends them the document via email from support@sourcecodeals.com. Admins manually track who received documents and toggle signed status when returned. The marketplace gate changes from requiring BOTH NDA and Fee Agreement to requiring at least ONE.

---

## Current State

- **PandaDoc integration**: 5 edge functions (`get-buyer-nda-embed`, `get-buyer-fee-embed`, `confirm-agreement-signed`, `pandadoc-webhook-handler`, `get-agreement-document`) handle embedded signing
- **Frontend components**: `PandaDocSigningPanel`, `AgreementSigningModal`, `NdaGateModal`, `FeeAgreementGate` embed PandaDoc iframes
- **Buyer surfaces**: Profile Documents tab, My Deals (DealDocumentsCard, DealActionCard), Messages (AgreementSection), PendingApproval page, ListingDetail NDA gate
- **Admin surface**: DocumentTrackingPage with `AgreementStatusDropdown` for manual status changes
- **Marketplace gate**: ConnectionButton requires `nda_covered` AND `fee_covered`
- **Database**: `firm_agreements` table tracks statuses, `agreement_audit_log` for history

## What Changes

### 1. Database: Add Document Request Tracking

**New table: `document_requests`**
- `id`, `firm_id`, `user_id`, `agreement_type` (nda/fee_agreement), `requested_at`, `email_sent_at`, `signed_at`, `signed_toggled_by` (admin user_id), `signed_toggled_by_name`, `status` (requested/email_sent/signed/cancelled), `created_at`
- Tracks each individual signing request so admins see a queue of pending requests

**New columns on `firm_agreements`:**
- `nda_requested_at`, `fee_agreement_requested_at` — timestamp of most recent request
- `nda_requested_by` (user_id), `fee_agreement_requested_by` (user_id)

### 2. New Edge Function: `request-agreement-email`

Replaces `get-buyer-nda-embed` and `get-buyer-fee-embed`. When a buyer clicks "Request NDA" or "Request Fee Agreement":

1. Resolves firm via `resolve_user_firm_id` (with self-heal)
2. Checks if already signed — returns early if so
3. Inserts a row into `document_requests` with status `requested`
4. Sends an email to the buyer from support@sourcecodeals.com with the appropriate document attached (NDA or Fee Agreement PDF from Supabase Storage)
5. Updates `document_requests.status` to `email_sent` and sets `email_sent_at`
6. Creates `admin_notifications` for all admins: "John Doe (john@acme.com) requested NDA signing"
7. Updates `firm_agreements` with `nda_requested_at`/`fee_agreement_requested_at`
8. Returns `{ success: true, message: "Document sent to your email" }`

### 3. Buyer-Side UI Changes

**A. Replace `AgreementSigningModal`** — Instead of opening a PandaDoc embed, show a simple confirmation dialog: "We'll email you the [NDA/Fee Agreement] to sign. Click below to request it." with a "Send to My Email" button. On success, show: "Document sent! Check your inbox at [email]. Return the signed copy to support@sourcecodeals.com."

**B. Replace `NdaGateModal`** — Change from full-screen PandaDoc embed to a gate that says: "Sign your NDA to view this deal. Click below and we'll email you the document." with a "Request NDA via Email" button.

**C. Replace `FeeAgreementGate`** — Same pattern: "Request Fee Agreement via Email" button instead of embedded form.

**D. Profile Documents tab** — Show document status with new states:
- Not Requested → "Request NDA" / "Request Fee Agreement" button
- Requested/Email Sent → "Document sent to your email — return signed copy to support@sourcecodeals.com" with timestamp
- Signed → Green checkmark with signed date

**E. My Deals: `DealDocumentsCard` and `DealActionCard`** — Replace "Sign Now" PandaDoc buttons with "Request via Email" buttons. Show pending status if already requested.

**F. Messages: `AgreementSection`** — Update to show email-based flow status instead of PandaDoc status.

**G. PendingApproval page** — Replace PandaDoc embed with email request button for NDA.

### 4. Admin Document Tracking Revamp

**A. Pending Requests Badge** — Add a red notification badge next to "Document Tracking" in the admin sidebar showing count of pending (requested but not signed) document requests.

**B. New filter: "Pending Requests"** — Adds a filter option to show only firms with active signing requests.

**C. Row highlighting** — Firms with pending requests get an amber/yellow background row highlight so admins immediately see which firms need attention.

**D. Sort by most recent request** — Default sort changes to show most recent document requests first (new `last_requested` sort option).

**E. Admin sign-off toggle** — When admin toggles a document to "signed", the system:
- Records which admin did it (`signed_toggled_by`, `signed_toggled_by_name`)
- Updates `document_requests.status` to `signed` with `signed_at`
- Updates `firm_agreements` status to `signed` with admin attribution
- Logs to `agreement_audit_log` with admin name
- Shows the admin name in the audit trail

**F. Visible admin attribution** — In the expanded row audit log and inline date columns, show which admin marked the document as signed.

**G. Stats cards update** — Add "Pending Requests" stat card showing count of outstanding requests.

### 5. Marketplace Gate Change

**ConnectionButton** gate logic changes from:
```
NDA required AND Fee Agreement required
```
to:
```
At least ONE of (NDA signed OR Fee Agreement signed) required
```

Specifically:
- Change `!coverage.nda_covered` block to check `!coverage.nda_covered && !coverage.fee_covered`
- Remove the fee agreement gate entirely from the connection flow
- Update the `enhanced_merge_or_create_connection_request` RPC server-side gate to match (require at least one instead of NDA specifically)

### 6. Realtime & Sync

- Extend `useAgreementStatusSync` to also subscribe to `document_requests` table changes
- When a request comes in, invalidate `admin-document-tracking` and `admin-pending-doc-requests` query keys
- Admin sidebar badge updates in realtime

### 7. Edge Functions to Deprecate/Remove

- `get-buyer-nda-embed` — replaced by `request-agreement-email`
- `get-buyer-fee-embed` — replaced by `request-agreement-email`
- `confirm-agreement-signed` — no longer needed (admin toggles manually)
- `pandadoc-webhook-handler` — no longer needed
- `get-agreement-document` — keep if PDF download is still needed, otherwise remove

### 8. Components to Remove/Replace

- `src/components/pandadoc/PandaDocSigningPanel.tsx` — delete
- `src/components/pandadoc/AgreementSigningModal.tsx` — rewrite as email request dialog
- `src/components/pandadoc/NdaGateModal.tsx` — rewrite as email request gate
- `src/components/pandadoc/FeeAgreementGate.tsx` — rewrite as email request gate

---

## Technical Details

### Database Migration

```sql
-- Document request tracking table
CREATE TABLE public.document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES public.firm_agreements(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agreement_type text NOT NULL CHECK (agreement_type IN ('nda', 'fee_agreement')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'email_sent', 'signed', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  email_sent_at timestamptz,
  signed_at timestamptz,
  signed_toggled_by uuid REFERENCES auth.users(id),
  signed_toggled_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "Users can view own requests" ON public.document_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own requests  
CREATE POLICY "Users can create own requests" ON public.document_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can view and update all
CREATE POLICY "Admins can manage all requests" ON public.document_requests
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- Add request tracking to firm_agreements
ALTER TABLE public.firm_agreements 
  ADD COLUMN IF NOT EXISTS nda_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS nda_requested_by uuid,
  ADD COLUMN IF NOT EXISTS fee_agreement_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS fee_agreement_requested_by uuid;
```

### Email Sending

The `request-agreement-email` edge function will use Brevo (existing email provider) to send the document. The NDA and Fee Agreement PDFs should be uploaded to Supabase Storage (`agreement-templates` bucket) so they can be attached or linked in the email.

### Implementation Order

1. Database migration (new table + columns)
2. Upload NDA/Fee Agreement PDF templates to Storage
3. Create `request-agreement-email` edge function
4. Rewrite buyer-facing components (AgreementSigningModal → EmailRequestDialog, NdaGateModal, FeeAgreementGate)
5. Update Profile Documents, My Deals cards, Messages section, PendingApproval
6. Revamp admin DocumentTrackingPage (pending badge, row highlighting, request queue)
7. Update admin sidebar with pending requests badge
8. Change marketplace gate logic (at least one document)
9. Update server-side RPC gate
10. Add realtime subscriptions for document_requests
11. Remove/deprecate PandaDoc edge functions and components

