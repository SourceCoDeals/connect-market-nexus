

# Three Changes: Fee Agreement Required, Data Room Messaging, Motivational Copy

## Summary

Three interconnected changes:
1. **Access rule change**: Fee Agreement is now the required document (not NDA). NDA alone is insufficient. Fee Agreement alone is sufficient.
2. **Data room motivation copy**: Update all agreement prompts to emphasize what they unlock -- the data room containing the CIM, real company name, and full business details.
3. **Listing detail CTA**: Prominently tell buyers that requesting a connection grants data room access (immediately if fee agreement is signed).

## 1. Access Rule Change: Fee Agreement Required

### Current rule
`!nda_covered && !fee_covered` = blocked (either one works)

### New rule
`!fee_covered` = blocked (fee agreement is the gate; NDA alone is not enough; fee alone is fine)

### Files changed

**Client-side gates (4 files):**

- `src/components/listing-detail/ConnectionButton.tsx`
  - Line 58: change `(!coverage.nda_covered && !coverage.fee_covered)` to `!coverage.fee_covered`
  - Line 181: change `!coverage.nda_covered && !coverage.fee_covered` to `!coverage.fee_covered`

- `src/components/listing/ListingCardActions.tsx`
  - Line 114: change `!isNdaCovered && !isFeeCovered` to `!isFeeCovered`
  - Line 173: change `!isNdaCovered && !isFeeCovered` to `!isFeeCovered`

- `src/components/ListingCard.tsx`
  - The `isNdaCovered` prop is no longer needed for gating but can stay for display. The card passes both to `ListingCardActions` which handles the logic.

- `src/pages/PendingApproval.tsx`
  - Line 43: change `agreementStatus?.nda_covered || agreementStatus?.fee_covered` to `agreementStatus?.fee_covered`

**Server-side gate (1 migration):**

- `enhanced_merge_or_create_connection_request` RPC: Change the check from "at least one (NDA or Fee)" to "Fee Agreement must be signed". Update error message to "A Fee Agreement must be signed before requesting deal access."

**Banner (1 file):**

- `src/components/marketplace/AgreementStatusBanner.tsx`
  - Line 59-65: Update the locked message from "An agreement (NDA or Fee Agreement) is required" to "A signed Fee Agreement is required to request deal access and unlock the data room."
  - Line 102: Remove the comment about NDA being sufficient; fee is now the gate.

## 2. Motivational Copy: Emphasize Data Room Access

Update all agreement-related prompts to make clear what signing unlocks.

**ConnectionButton.tsx (unsigned block, lines 260-270):**
- Change "Sign an Agreement" heading to "Sign Your Fee Agreement"
- Change "An NDA or Fee Agreement is required to request deal access" to "A signed Fee Agreement unlocks the data room, including the CIM, real company name, and full business details."
- Change "Save this listing so you can request access after signing" to "Sign now to unlock full deal access."

**ListingCardActions.tsx (unsigned block, lines 196-199):**
- Change "Sign Agreement to Request Access" to "Sign Fee Agreement to Unlock Access"
- Change "Save this listing for later. Sign your agreement to request access." to "Sign your Fee Agreement to unlock the data room and request introductions."

**BlurredFinancialTeaser.tsx (lines 64-68):**
- Update heading to "Unlock the Data Room"
- Update description to mention CIM, real company name, and full financials: "Request a connection to access the full data room, including the Confidential Information Memorandum (CIM), real company name, and complete financials."

**notify-agreement-confirmed edge function:**
- Update email body to specifically mention data room access: "You now have full access to browse deals, request introductions, and access the data room on approved deals."

## 3. Listing Detail Sidebar: Prominent Data Room CTA

**ListingDetail.tsx (lines 331-338):**
- Update sidebar heading from "Request an Introduction" to "Request Access to This Deal"
- Update description from "Our team will make a direct introduction to the business owner." to "Request a connection to unlock the data room. Once approved, you get immediate access to the CIM, real company name, and full business details."

**ConnectionButton.tsx (line 103, button text):**
- Change "Request Full Deal Details" (line 103) to "Request Connection and Data Room Access"

## Files Changed

- `src/components/listing-detail/ConnectionButton.tsx` -- gate logic + copy
- `src/components/listing/ListingCardActions.tsx` -- gate logic + copy
- `src/components/ListingCard.tsx` -- minor (gate logic flows through props)
- `src/pages/PendingApproval.tsx` -- gate logic
- `src/components/marketplace/AgreementStatusBanner.tsx` -- banner copy
- `src/components/listing-detail/BlurredFinancialTeaser.tsx` -- copy
- `src/pages/ListingDetail.tsx` -- sidebar copy
- `supabase/functions/notify-agreement-confirmed/index.ts` -- email copy
- New SQL migration -- server-side gate update

