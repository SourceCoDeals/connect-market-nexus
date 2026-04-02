

# Document Signing Revamp — Gap Analysis & Implementation Plan

## What's Already Done (Working)

1. **Database**: `document_requests` table created with RLS policies. `firm_agreements` has `nda_requested_at`, `fee_agreement_requested_at`, `nda_requested_by`, `fee_agreement_requested_by` columns.
2. **Edge Function**: `request-agreement-email` sends email via Brevo, inserts `document_requests`, updates `firm_agreements` timestamps, notifies admins.
3. **Buyer UI — AgreementSigningModal**: Rewritten for email-based flow (no PandaDoc embed).
4. **Buyer UI — NdaGateModal**: Rewritten for email-based flow.
5. **Buyer UI — FeeAgreementGate**: Rewritten for email-based flow.
6. **ConnectionButton**: Gate changed to "at least one of NDA or Fee Agreement".
7. **Admin sidebar**: Red badge for pending doc requests via `usePendingDocumentRequests`.
8. **DocumentTrackingPage**: Has `pending_requests` filter, amber row highlighting for pending requests, realtime subscription on `document_requests`.
9. **DealDocumentsCard & DealActionCard**: Already use `AgreementSigningModal` (email-based).
10. **Realtime sync**: `useAgreementStatusSync` subscribes to `document_requests`.

## What's Broken or Missing

### Critical — Broken

1. **PendingApproval page** — Still calls `get-buyer-nda-embed` (PandaDoc) and renders `PandaDocSigningPanel` iframe. Will fail for all users on that page.

2. **Server-side RPC gate mismatch** — `enhanced_merge_or_create_connection_request` still enforces NDA-only (`check_agreement_coverage(email, 'nda')`). Client says "at least one" but server blocks users who only have Fee Agreement signed. Connection requests will fail with "NDA must be signed" for fee-only users.

3. **ProfileDocuments tab** — Still queries PandaDoc-specific columns (`nda_pandadoc_signed_url`, `nda_pandadoc_document_id`, `nda_pandadoc_status`, etc.) and uses PandaDoc status resolution. Need to simplify to show email-based request status and use `AgreementSigningModal`.

4. **BuyerMessages AgreementSection** — Still references PandaDoc columns (`nda_pandadoc_status`, `nda_pandadoc_signed_url`, `fee_pandadoc_status`, etc.) for status resolution. Should use simplified status from `firm_agreements.nda_status`/`fee_agreement_status` directly.

5. **Admin MessageCenter** — References `nda_pandadoc_status` and `fee_pandadoc_status` for status resolution.

6. **`last_requested` sort not implemented** — Declared as a sort type but never handled in the sort logic. Sorting by "most recent request first" doesn't work.

### Missing — Planned but Not Built

7. **Pending Requests stat card** — The plan called for a "Pending Requests" stat card on DocumentTrackingPage. Currently has Total Firms, NDA Signed, Fee Signed, Needs Attention, Orphan Users — but no pending request count card.

8. **Admin attribution on sign toggle** — When admin toggles status to "signed" via `AgreementStatusDropdown`, the `document_requests` record is not updated (no `signed_at`, `signed_toggled_by`, `signed_toggled_by_name`). Admin attribution isn't tracked on the request itself.

9. **Email attachment** — The edge function sends a plain HTML email explaining the process, but doesn't actually attach or link the NDA/Fee Agreement PDF. Need PDF templates in Supabase Storage and download links in the email.

10. **EmailTestCentre** — Still references `confirm-agreement-signed` function for NDA/fee completion email tests. Should reference the new flow.

### Cleanup — PandaDoc Remnants

11. **PandaDocSigningPanel.tsx** — Component still exists; used by PendingApproval.
12. **SendAgreementDialog.tsx** — Still references PandaDoc embed URLs.
13. **Edge functions still deployed**: `get-buyer-nda-embed`, `get-buyer-fee-embed`, `confirm-agreement-signed`, `pandadoc-webhook-handler`, `get-agreement-document` — should be deprecated/removed.
14. **`use-pandadoc.ts` hooks** — Still imported by PendingApproval and possibly others.

---

## Implementation Plan

### Step 1: Fix Server-Side RPC Gate
Update `enhanced_merge_or_create_connection_request` to accept connection requests when the user has at least one signed agreement (NDA OR Fee Agreement), not just NDA. This aligns the server gate with the client-side `ConnectionButton` logic.

### Step 2: Fix PendingApproval Page
Replace `get-buyer-nda-embed` / `PandaDocSigningPanel` with the email-based `AgreementSigningModal`. Users on this page should see the same "Request NDA via Email" button.

### Step 3: Fix ProfileDocuments Tab
Remove PandaDoc column queries. Show simplified status: Not Requested / Requested / Email Sent / Signed. Add "Request via Email" buttons that open `AgreementSigningModal`. Show request timestamps from `document_requests` or `firm_agreements`.

### Step 4: Fix BuyerMessages AgreementSection
Remove PandaDoc status references. Use `firm_agreements.nda_status` and `fee_agreement_status` directly. Update `buildDocItem` to work without PandaDoc columns.

### Step 5: Fix Admin MessageCenter
Remove PandaDoc status resolution. Use `nda_status`/`fee_agreement_status` directly.

### Step 6: Complete DocumentTrackingPage
- Implement `last_requested` sort logic (sort by most recent `nda_requested_at` or `fee_agreement_requested_at`).
- Add "Pending Requests" stat card showing count of firms with active requests.
- Wire admin sign toggle to update `document_requests` with `signed_toggled_by`, `signed_toggled_by_name`, and `signed_at`.

### Step 7: Add PDF Links to Email
Upload NDA and Fee Agreement PDFs to Supabase Storage (`agreement-templates` bucket). Update `request-agreement-email` edge function to include a download link in the email body.

### Step 8: Clean Up PandaDoc Remnants
- Delete `PandaDocSigningPanel.tsx`
- Update/remove `SendAgreementDialog.tsx` PandaDoc references
- Update `EmailTestCentre` to reference new flow
- Remove `use-pandadoc.ts` if no longer needed
- Delete deprecated edge functions: `get-buyer-nda-embed`, `get-buyer-fee-embed`, `confirm-agreement-signed`, `pandadoc-webhook-handler`

### Step 9: Admin Attribution on Status Change
Update `AgreementStatusDropdown` mutation to also update the corresponding `document_requests` record when status changes to "signed" — recording which admin toggled it and when.

---

## Technical Details

### RPC Migration (Step 1)
```sql
-- Change NDA-only gate to "at least one agreement"
-- Replace the check_agreement_coverage('nda') block with:
-- Check both NDA and fee coverage; block only if NEITHER is signed
```

### Storage Bucket (Step 7)
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('agreement-templates', 'agreement-templates', true);
```
Admin uploads NDA.pdf and FeeAgreement.pdf. Edge function generates signed URLs or public links.

### Files Changed
- 1 database migration (RPC gate + admin attribution)
- 1 edge function update (`request-agreement-email` — add PDF link)
- ~8 component files updated (PendingApproval, ProfileDocuments, AgreementSection, MessageCenter, DocumentTrackingPage, AgreementStatusDropdown)
- ~4 files deleted (PandaDoc components + edge functions)

