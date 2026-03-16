
Not fully resolved yet.

What the screenshot proves:
- The buyer-side modal is still hitting the `hasFirm: false` path in `AgreementSigningModal`.
- The current deployed `get-buyer-nda-embed` and `get-buyer-fee-embed` functions still return:
  - `No firm found for this buyer`
  - `hasFirm: false`
- So the “self-healing” fallback for missing firm membership is not in place yet.

Why this is happening:
- `AgreementSigningModal` is working as coded: it shows that red error whenever the embed function says `hasFirm: false`.
- In `supabase/functions/get-buyer-nda-embed/index.ts` and `get-buyer-fee-embed/index.ts`, if `resolve_user_firm_id()` returns null, the function stops immediately instead of repairing the user → firm linkage.
- That means older buyers, cleaned-up buyers, or buyers missing `firm_members` rows can still get blocked from signing.

Plan to fix it properly

1. Add firm self-healing inside both buyer embed functions
- Files:
  - `supabase/functions/get-buyer-nda-embed/index.ts`
  - `supabase/functions/get-buyer-fee-embed/index.ts`
- If `resolve_user_firm_id()` returns null:
  - load the buyer profile
  - derive email domain
  - normalize company name using the same logic as `auto-create-firm-on-signup`
  - try to find an existing `firm_agreements` row by non-generic email domain
  - else try normalized company name
  - else create a new `firm_agreements` row
  - create the missing `firm_members` row
  - re-resolve the firm and continue normally
- This makes “Sign NDA” and “Sign Fee Agreement” self-repair instead of dead-ending.

2. Keep document tracking canonical while doing the repair
- The self-heal must only create/link the firm.
- It must not write agreement booleans onto `profiles`.
- Once the firm exists, the existing PandaDoc flow continues and updates only `firm_agreements`.
- Admin notifications already attached to the buyer opening the signing flow should continue to point to `/admin/documents`.

3. Make the rest of the buyer document flow resilient to the same missing-link problem
- Review these related flows and apply the same “repair before fail” pattern where needed:
  - `supabase/functions/get-agreement-document/index.ts`
  - `supabase/functions/confirm-agreement-signed/index.ts`
- Reason:
  - if embed self-heals but download/confirmation still hard-fails on missing firm, the buyer flow can still break in edge cases
  - all buyer-facing agreement entry points should resolve the same canonical firm consistently

4. Improve the buyer error state
- File:
  - `src/components/pandadoc/AgreementSigningModal.tsx`
- Replace the hard dead-end experience with a more accurate fallback:
  - show retry action
  - show a softer message for temporary setup issues
  - only show “contact us” after repair/retry truly fails
- This avoids false support errors when the backend could repair the linkage automatically.

5. Validate agreement tracking behavior end-to-end
- After self-heal, confirm this exact sequence stays correct:
  - buyer clicks “Sign NDA”
  - missing firm gets created/linked
  - PandaDoc doc/session is created or resumed
  - admin notification is created
  - `/admin/documents` shows the correct firm and status
  - webhook / confirm flow marks the agreement signed on `firm_agreements`
  - buyer-side screens refresh from the same source of truth

What must be considered so it works properly everywhere

- Firm resolution consistency
  - use the same matching rules as signup/approval flows
  - avoid generic domains like gmail/outlook for firm matching
  - prefer deterministic re-resolution after creating/linking membership

- No shadow agreement state
  - never restore profile-level NDA/Fee flags
  - `firm_agreements` remains the only agreement source of truth

- Duplicate prevention
  - avoid creating duplicate firms when normalized company or domain already matches
  - avoid duplicate `firm_members` inserts for the same user

- Admin visibility
  - repaired firms must appear naturally in `/admin/documents`
  - signing-request notifications should continue to attach enough metadata to identify the buyer/firm cleanly

- Legacy buyer accounts
  - this specifically protects older/testing accounts that were created before the current firm automation or were affected by cleanup

Technical scope
- Main implementation:
  - `supabase/functions/get-buyer-nda-embed/index.ts`
  - `supabase/functions/get-buyer-fee-embed/index.ts`
- Consistency review / likely follow-up hardening:
  - `supabase/functions/get-agreement-document/index.ts`
  - `supabase/functions/confirm-agreement-signed/index.ts`
  - `src/components/pandadoc/AgreementSigningModal.tsx`
- Reuse logic from:
  - `supabase/functions/auto-create-firm-on-signup/index.ts`

Definition of done
- A buyer with no current firm membership can click “Sign NDA” from My Deals and get the signing session instead of the setup error.
- The repaired firm association is canonical and reused by all agreement screens.
- `/admin/documents` reflects the correct firm and status without manual cleanup.
- Admin sees the signing request notification.
- Signed status updates only in `firm_agreements` and propagates correctly across buyer/admin screens.
