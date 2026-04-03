

# Fix Agreement Confirmation Email — NDA vs Fee Agreement Copy

## Problem

The `notify-agreement-confirmed` email sends the same copy for both NDA and Fee Agreement confirmations: "You now have full access to browse deals, request introductions, and access the data room on approved deals." This is misleading when only the NDA is signed — the Fee Agreement is what actually unlocks deal access and data room.

## Solution

Differentiate the email body and CTA based on `agreementType`:

### When `agreementType === 'fee_agreement'` (unlocks access)
- Copy: "Your Fee Agreement for [firm] has been recorded and confirmed. You now have full access to browse deals, request introductions, and access the data room on approved deals."
- CTA button: "Browse Deals" → links to `/marketplace`
- Preheader: "Your Fee Agreement is confirmed. You can now request deal introductions."

### When `agreementType === 'nda'` (does NOT unlock access)
- Copy: "Your NDA for [firm] has been recorded and confirmed. To unlock full access to deals and the data room, your Fee Agreement also needs to be signed. If you have not yet received your Fee Agreement, reply to this email and we will send it over."
- CTA button: "View Your Documents" → links to `/profile?tab=documents`
- Preheader: "Your NDA is confirmed. Sign your Fee Agreement to unlock deal access."

### Also check if Fee Agreement is already signed
Query `firm_agreements` for `fee_agreement_signed` status. If the firm already has a signed Fee Agreement when the NDA confirmation fires, use the full-access copy instead (since they already have both).

## File changed
- `supabase/functions/notify-agreement-confirmed/index.ts` — add conditional copy based on agreement type and firm's fee agreement status
- Deploy `notify-agreement-confirmed`

