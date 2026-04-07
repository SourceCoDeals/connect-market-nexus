

# Final Deep Audit: 8 Remaining Issues Found

## Fully Correct (No Changes Needed)
- `BlurredFinancialTeaser.tsx` heading + body copy
- `ConnectionButton.tsx` copy
- `ListingSidebarActions.tsx` gate logic
- `BuyerDataRoom.tsx` memo filtering + upgrade prompt
- `ListingDetail.tsx` CTA copy
- `AgreementStatusBanner.tsx` banner copy
- `useConnectionRequestsFilters.ts` approval message
- `grant-data-room-access` email copy
- `notify-agreement-confirmed` both branches
- `send-templated-approval-email` both branches (edge function)
- `DealLandingPage/DealSidebar.tsx` copy
- `ListingPreview.tsx` copy

## Still Wrong - 8 Locations

### 1. `supabase/functions/user-journey-notifications/index.ts` (line 31-32) - Welcome email
**Current:** "We send you two documents to sign: an NDA and a Fee Agreement... Once signed, you get full access to the deal pipeline, including confidential business details, financials, and direct introductions."
**Problem:** Over-promises full access and mentions NDA as a separate requirement. System now only requires Fee Agreement.
**Fix:** "To receive deal materials and request introductions, you will need to sign a Fee Agreement. It is success-only and takes about 60 seconds."

### 2. `supabase/functions/user-journey-notifications/index.ts` (line 45) - Approval email
**Current:** "Your SourceCo account has been approved. You now have full access to the marketplace."
**Problem:** Over-promises "full access."
**Fix:** "Your SourceCo account has been approved. You can now browse deals and request connections."

### 3. `supabase/functions/user-journey-notifications/index.ts` (lines 76-78) - Email Verified email
**Current:** "You sign two documents: an NDA and a Fee Agreement... Full access to the deal pipeline: confidential details, financials, and direct introductions to founders."
**Problem:** Same NDA + full access over-promise.
**Fix:** Same pattern as #1 - mention only Fee Agreement, soften to "deal materials."

### 4. `supabase/functions/_shared/email-templates.ts` (line 176) - Approval template
**Current:** "You now have full access to the SourceCo marketplace."
**Problem:** Over-promises full access.
**Fix:** "You can now browse deals and request connections on the SourceCo marketplace."

### 5. `src/pages/admin/EmailTestCentre.tsx` (lines 78-81) - Welcome email preview
**Current:** Same "two documents" + "full access" copy as the edge function.
**Fix:** Match updated edge function copy from #1.

### 6. `src/pages/admin/EmailTestCentre.tsx` (lines 105-108) - Email Verified preview
**Current:** Same over-promise as the edge function.
**Fix:** Match updated edge function copy from #3.

### 7. `src/components/admin/emails/EmailCatalog.tsx` (line 132) - Marketplace Signup Approved preview
**Current:** "you now have full access to our curated platform for off-market deal flow"
**Fix:** "you now have access to our curated platform for off-market deal flow" (remove "full")

### 8. `src/components/admin/emails/EmailCatalog.tsx` (lines 211, 217, 261, 270, 426) - Multiple preview entries
Several EmailCatalog preview entries still reference "full access" or over-promise data room contents:
- Line 211: subject "Full access is live" - acceptable (NDA-signed variant, admin preview)
- Line 217: "access the complete data room, financials, and all deal materials" - over-promises
- Line 261: "It contains financial documents, operational data, and other confidential materials" - over-promises
- Line 270: "full access to browse deals" - borderline but acceptable (fee agreement confirmed)
- Line 426: "full access to the SourceCo marketplace" - over-promises

**Fix lines 217 and 261** to match the actual email copy. Lines 211 and 270 are acceptable in context. Line 426 should drop "full."

### Typography note
`NdaGateModal.tsx` line 62 and `EmailTestCentre.tsx` line 125 use em-dashes, which violates the project's copywriting standards. These should be hyphens.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/user-journey-notifications/index.ts` | Update welcome (lines 30-34), approval (line 45), email-verified (lines 76-78) copy |
| `supabase/functions/_shared/email-templates.ts` | Update approval template copy (line 176) |
| `src/pages/admin/EmailTestCentre.tsx` | Match all updated edge function copy (lines 78-81, 105-108); fix em-dash in line 125 |
| `src/components/admin/emails/EmailCatalog.tsx` | Fix preview HTML lines 132, 217, 261, 426 |
| `src/components/pandadoc/NdaGateModal.tsx` | Fix em-dash on line 62 (use hyphen) |

## Post-Change
Redeploy `user-journey-notifications` edge function. No other edge functions need redeployment (`_shared/email-templates.ts` is used by other functions that should also be redeployed if they reference the approval template at runtime).

