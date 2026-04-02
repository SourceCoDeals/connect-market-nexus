

# Fix Resend — Wrong Parameter Name

## Root Cause

`ConnectionButton.tsx` line 194-196 sends `{ agreementType: type }` to the `request-agreement-email` edge function, but the function expects `{ documentType: ... }`. The function validates `documentType` and returns 400 "Invalid documentType" immediately.

This is a one-line fix.

## Change

**File: `src/components/listing-detail/ConnectionButton.tsx`** — Line 195: change `agreementType: type` to `documentType: type`.

## Admin "Resend Email" from dropdown

Already correct — `AgreementStatusDropdown.tsx` line 123 sends `documentType`. No fix needed there.

## Other callers

`NdaGateModal`, `FeeAgreementGate`, `AgreementSigningModal`, `SendAgreementDialog` — all already use `documentType`. Only `ConnectionButton` has the bug.

