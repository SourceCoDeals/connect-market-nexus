

# Final Audit: 5 Remaining Issues

## Already Fixed (Confirmed across all previous rounds)
All 11 items from prior rounds are correctly implemented: memo filtering, sidebar gate, BlurredFinancialTeaser, ConnectionButton, ListingSidebarActions, ListingDetail CTA, AgreementStatusBanner, notify-agreement-confirmed (full-access branch), grant-data-room-access, useConnectionRequestsFilters approval message, EmailCatalog, BuyerDataRoom upgrade prompt.

## Still Wrong — 5 Locations

### 1. `supabase/functions/send-templated-approval-email/index.ts` (line 103)
**Current:** "To view full deal details, access data rooms, and request introductions, you will need to sign two standard documents: an NDA and a Fee Agreement."
**Problem:** Promises "access data rooms" before any deal connection exists. Over-promises scope.
**Fix:** "To receive deal materials and request introductions, you will need to sign a Fee Agreement. You can request one from your profile or any listing page. It takes about 60 seconds."
Also remove NDA mention — the system now only requires a Fee Agreement per the security gate registry.

### 2. `src/pages/admin/EmailTestCentre.tsx` (line 132)
**Current:** Same "access data rooms" copy as above (duplicate preview HTML).
**Fix:** Match the updated copy from #1.

### 3. `src/pages/DealLandingPage/components/DealSidebar.tsx` (line 100)
**Current:** "Get full access to detailed financials and business metrics."
**Problem:** This is the public-facing deal landing page sidebar CTA. Promises "full access to detailed financials" which most buyers won't get initially.
**Fix:** "Get access to deal materials and business details."

### 4. `src/pages/ListingPreview.tsx` (line 234)
**Current:** "Get full access to detailed financials and business metrics"
**Problem:** Same over-promise on the listing preview page.
**Fix:** "Get access to deal materials and business details"

### 5. `src/components/pandadoc/NdaGateModal.tsx` (line 76)
**Current:** "Once processed, you'll have full access."
**Problem:** Signing doesn't guarantee full access — admin toggles still control what buyers see.
**Fix:** "Once processed, you'll be able to request deal introductions and receive deal materials."

## Borderline / Acceptable (No Change Needed)

- **`DealDocumentsCard.tsx`** (line 338): "Deal Memorandum / CIM" — This is a document category label showing what COULD be available, not a promise. The locked state with the lock icon makes it clear it's not yet accessible. Acceptable.
- **`ApprovalEmailDialog.tsx`** (line 121): "Instructions to sign NDA + Fee Agreement for full access" — This is an admin-facing description of email contents. Not buyer-facing. Acceptable.
- **`notify-agreement-confirmed` NDA-only branch**: Already fixed in prior round.
- **Admin-only labels** like "Grant Data Room" in AccessMatrixPanel: Admin terminology, not buyer-facing. No change needed.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/send-templated-approval-email/index.ts` | Update line 103 copy; also update text version on line 115 |
| `src/pages/admin/EmailTestCentre.tsx` | Match updated copy from the edge function |
| `src/pages/DealLandingPage/components/DealSidebar.tsx` | Line 100: soften to "deal materials" |
| `src/pages/ListingPreview.tsx` | Line 234: soften to "deal materials" |
| `src/components/pandadoc/NdaGateModal.tsx` | Line 76: remove "full access" promise |

## Post-Change
Redeploy `send-templated-approval-email` edge function. No other edge functions need redeployment.

