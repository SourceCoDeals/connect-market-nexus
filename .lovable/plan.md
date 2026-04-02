

# Document Signing — Root Cause & Fix Plan

## Critical Bug: Edge Function Returns 401

The `request-agreement-email` function is **not listed in `supabase/config.toml`**, so Supabase defaults to `verify_jwt = true`. The gateway rejects the request at the infrastructure level before any code runs. This is why:
- No record appears in `document_requests` (function never executes)
- No email is sent
- No indication appears in Document Tracking

The analytics logs confirm: `POST | 401 | request-agreement-email`.

## Other Issues Raised

1. **Once signed, block re-sending**: The `AgreementStatusDropdown` already blocks "Send" when status is `signed` (valid transitions from `signed` are only `sent` and `expired`). The edge function also returns `alreadySigned: true`. However, the buyer-side `AgreementSigningModal` does not check if a previous request was already made — it always shows the "Send to My Email" button without context.

2. **Show previous request info**: When a buyer has already requested a document (status is `sent` on `firm_agreements`), the modal should show "An email was sent to you on [date]. You can request again if needed." Currently it shows no history.

---

## Implementation Steps

### Step 1: Add `request-agreement-email` to config.toml
Add `verify_jwt = false` so the function can receive requests. Authentication is handled in-code via `requireAuth()`.

**File:** `supabase/config.toml`

### Step 2: Redeploy the edge function
Deploy `request-agreement-email` so the config change takes effect.

### Step 3: Show previous request date in AgreementSigningModal
Query the user's agreement status (from the existing `check_agreement_coverage` or `get_my_agreement_status` RPC) to get `nda_requested_at` / `fee_agreement_requested_at`. If a previous request exists, show an info message: "An email was sent to [email] on [date]. You can request again below."

**File:** `src/components/pandadoc/AgreementSigningModal.tsx`
- Accept optional `agreementStatus` prop or fetch it internally
- When `activeType` is set and a previous request date exists, display it above the send button

### Step 4: Disable signing option when already signed
In the chooser step of `AgreementSigningModal`, if a doc is already signed, show it as completed (checkmark, "Signed" label) and disable the button. Only show the unsigned option as actionable.

**File:** `src/components/pandadoc/AgreementSigningModal.tsx`
- Pass `agreementStatus` (nda_covered, fee_covered) into the modal
- Render signed docs with a green checkmark instead of a clickable button

---

## Files Changed
- `supabase/config.toml` — add `[functions.request-agreement-email]` with `verify_jwt = false`
- `src/components/pandadoc/AgreementSigningModal.tsx` — show previous request date + disable signed docs

