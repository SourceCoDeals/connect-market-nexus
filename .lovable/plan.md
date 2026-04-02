

# Document Signing Revamp — Final Audit

## Status: ~97% Complete

The core system is solid. All data hooks, edge functions, admin tracking, realtime subscriptions, pending queue, audit logs, and gating logic are implemented correctly. Only one functional gap remains.

---

## Remaining Issue: Marketplace Modal Only Offers NDA (Not Both Documents)

When a user without any agreement clicks "Sign Agreement" from a marketplace listing card or from the ConnectionButton on listing detail, the `AgreementSigningModal` opens with `documentType="nda"` hardcoded. The user cannot choose Fee Agreement from this flow.

This occurs in three places:
- `ListingCardActions.tsx` line 200 — `documentType="nda"`
- `ListingCardActions.tsx` line 294 — `documentType="nda"` (second instance, after connection actions)
- `ConnectionButton.tsx` line 204 — `documentType="nda"`

Meanwhile, the `NdaGateModal` (full-screen gate on listing detail page) and `PendingApproval` correctly offer both NDA and Fee Agreement buttons.

### Fix

Convert `AgreementSigningModal` into a two-step chooser when no `documentType` is pre-selected. Add an optional `documentType` prop (make it optional instead of required). When omitted, the modal shows a first screen: "Choose Your Agreement" with two buttons — Request NDA and Request Fee Agreement. Once the user picks one, proceed to the current send flow.

Alternatively (simpler): add local state in `ListingCardActions` and `ConnectionButton` so the modal renders with a choice step. The simplest approach is to add an intermediate state variable `signingType` and show both options inside the existing modal before sending.

### Files to Change
- `src/components/pandadoc/AgreementSigningModal.tsx` — make `documentType` optional; when not provided, show chooser step with both NDA and Fee Agreement buttons
- `src/components/listing/ListingCardActions.tsx` — remove hardcoded `documentType="nda"`, pass no `documentType` (or undefined) so chooser appears
- `src/components/listing-detail/ConnectionButton.tsx` — same change

### Everything Else: Verified Working

| Area | Status |
|------|--------|
| ListingCardActions — "either doc" gate logic | Correct (`!isNdaCovered && !isFeeCovered`) |
| ListingCardActions — inline modal (not redirect) | Correct (`setSigningOpen(true)`) |
| ListingDetail — gate condition | Correct |
| NdaGateModal — offers both docs | Correct |
| ConnectionButton — "either doc" gate | Correct |
| PendingApproval — both NDA + Fee buttons | Correct |
| PendingApproval — uses `useMyAgreementStatus` | Correct |
| ProfileDocuments — email-based request/resend | Correct |
| AgreementSection (Messages) — uses modal | Correct |
| DealActionCard — "either doc" | Correct |
| DealDocumentsCard — "either doc" | Correct |
| Edge function — syncs both tables + admin override | Correct |
| DocumentTrackingPage — pending queue with `agreement_type` | Correct |
| DocumentTrackingPage — amber highlighting | Correct |
| DocumentTrackingPage — "Mark Signed" with admin attribution | Correct |
| Realtime — invalidates all three query keys | Correct |
| Sidebar badge — counts from `document_requests` | Correct |
| Audit log — shows admin name | Correct |

