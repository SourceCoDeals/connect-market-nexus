

## Remove Signing Banner from Marketplace + Add Signing to Profile Documents + Ensure Universal Status Sync

### Problem

1. **Marketplace (`/`) shows a "Sign NDA" banner** (`PendingSigningBanner`) that shouldn't be there -- the user wants signing prompts to live in the Profile > Documents tab instead, surfaced via notifications.
2. **Profile Documents tab** only shows already-signed documents -- it has no ability to sign pending documents.
3. **Status sync gaps remain**: signing in one place doesn't reliably update all other surfaces (admin Document Tracking, Messages, Profile Documents, ActionHub, DealNextSteps, ListingDetail NDA gate, etc.).

### Plan

#### 1. Remove PendingSigningBanner from Marketplace page

**File: `src/pages/Marketplace.tsx`**
- Remove the `<PendingSigningBanner />` component and its import (lines 17, 185).
- The marketplace becomes a clean listings-only view.

#### 2. Upgrade ProfileDocuments to show pending + signed documents with signing capability

**File: `src/pages/Profile/ProfileDocuments.tsx`**
- Refactor `useSignedDocuments` to show ALL documents (both signed and pending/unsigned).
- Use deterministic firm resolution (connection_requests first, then firm_members) -- same pattern as `useFirmAgreementStatus`.
- For unsigned documents, show a "Sign Now" button that opens the `AgreementSigningModal`.
- For signed documents, keep the existing download button.
- Add status chips (Signed/Pending/Ready to Sign) consistent with the Messages AgreementSection.
- Add a notification-style callout at the top when documents are awaiting signature: "You have documents ready for signing" with a gold accent.
- Import and use `useAgreementStatusSync()` for realtime updates.

#### 3. Ensure notification bell drives users to Profile > Documents tab

**File: `src/components/buyer/BuyerNotificationBell.tsx`** (or `AgreementAlertModal`)
- When a user has an `agreement_pending` notification, the deep link / action should navigate to `/profile?tab=documents` instead of opening a modal or going nowhere.
- This ensures the flow is: Notification bell -> click -> Profile Documents tab -> Sign Now.

#### 4. Universal status sync -- ensure all consumers invalidate consistently

The `invalidateAgreementQueries` function in `src/hooks/use-agreement-status-sync.ts` already invalidates these keys at 0s/2s/5s:
- `buyer-firm-agreement-status`
- `my-agreement-status`
- `buyer-nda-status`
- `buyer-signed-documents`
- `firm-agreements`
- `admin-document-tracking`
- `inbox-threads`
- etc.

**Verify and fix** that `useAgreementStatusSync()` is called in all relevant consumer components:
- `ProfileDocuments` -- add `useAgreementStatusSync()` (currently missing)
- `useFirmAgreementStatus` -- already has it
- `ActionHub` -- needs it added (currently reads `useMyAgreementStatus` but no realtime sub)
- `DealNextSteps` -- reads props from parent, parent (`MyRequests`) needs the sync hook
- `ListingDetail` -- uses `useBuyerNdaStatus`, needs sync hook added
- `ConnectionButton` -- uses `useMyAgreementStatus`, needs sync hook added

**Files to add `useAgreementStatusSync()` call:**
- `src/pages/Profile/ProfileDocuments.tsx`
- `src/components/deals/ActionHub.tsx`
- `src/pages/MyRequests.tsx`
- `src/pages/ListingDetail.tsx`
- `src/components/listing-detail/ConnectionButton.tsx`

#### 5. Confirm-agreement-signed: ensure email notifications fire

Already implemented in the previous iteration. The `confirm-agreement-signed` edge function sends branded emails to both buyer and admins upon successful signing. No changes needed here, but deployment must be verified.

### Summary of file changes

| File | Change |
|------|--------|
| `src/pages/Marketplace.tsx` | Remove `PendingSigningBanner` import and usage |
| `src/pages/Profile/ProfileDocuments.tsx` | Show all documents (pending + signed), add Sign Now buttons, add `AgreementSigningModal`, add realtime sync |
| `src/components/buyer/BuyerNotificationBell.tsx` | Update agreement notification deep link to `/profile?tab=documents` |
| `src/components/deals/ActionHub.tsx` | Add `useAgreementStatusSync()` |
| `src/pages/MyRequests.tsx` | Add `useAgreementStatusSync()` |
| `src/pages/ListingDetail.tsx` | Add `useAgreementStatusSync()` |
| `src/components/listing-detail/ConnectionButton.tsx` | Add `useAgreementStatusSync()` |

### What stays the same
- Messages AgreementSection (already has signing + sync)
- Admin Document Tracking (already has realtime sub)
- NdaGateModal on ListingDetail (still blocks unsigned buyers from deal details)
- FeeAgreementGate on ConnectionButton (still blocks unsigned buyers from requesting)
- Edge functions (already deployed with CORS fix + email notifications)

