

# Final Gap Analysis: Agreement Tracking Integrity

## What's Done (Confirmed Working)
- Frontend hooks (`useConnectionRequestFirm`, `useConnectionRequestActions`, `DualNDAToggle`, `DualFeeAgreementToggle`, `ProfileDocuments`, `MessageCenter`, pipeline filters) all use canonical `resolve_user_firm_id` RPC or `firm_members` table
- `company` and `buyer_type` locked via `PRIVILEGED_FIELDS` + disabled in ProfileForm + DB trigger
- `auto-create-firm-on-approval` edge function re-resolves firms
- `get-agreement-document` edge function uses `resolve_user_firm_id` RPC
- `get-document-download` uses `firm_members` table (acceptable)
- Profile-level boolean fallbacks removed from all frontend components

## What's Still Broken

### 1. THREE edge functions still use the OLD circular `resolveFirmId()` (CRITICAL)

Each contains an identical `resolveFirmId()` function that queries `connection_requests.firm_id` first, falling back to `firm_members`. This is the exact circular pattern that caused the original bug.

| Function | Impact |
|----------|--------|
| `get-buyer-nda-embed` | Buyer opens NDA signing form for the WRONG firm |
| `get-buyer-fee-embed` | Buyer opens fee agreement signing form for the WRONG firm |
| `confirm-agreement-signed` | Signing confirmation marks the WRONG firm as signed |

**Fix**: Replace `resolveFirmId()` in all three with the canonical `resolve_user_firm_id` RPC call via `supabaseAdmin.rpc('resolve_user_firm_id', { p_user_id: userId })`.

### 2. Self-heal logic in embed functions writes back to `profiles` table (MEDIUM)

`get-buyer-nda-embed` (lines 190-196) and `get-buyer-fee-embed` (lines 182-188) write `nda_signed: true` / `fee_agreement_signed: true` back to the `profiles` table when PandaDoc reports a completed document. This keeps stale profile-level booleans alive as a shadow data source.

**Fix**: Remove the profile-level writes. The `firm_agreements` update is sufficient — all frontend consumers already read from firm-level data.

### 3. `use-user-connection-requests.ts` fetches profile-level agreement fields (LOW)

Line 38 selects `fee_agreement_signed, fee_agreement_signed_at, fee_agreement_email_sent, fee_agreement_email_sent_at, nda_signed, nda_signed_at, nda_email_sent, nda_email_sent_at` from `profiles`. These fields are mapped into the `User` object via `createUserObject()` and feed into the admin pipeline sidebar's `useConnectionRequestActions`. However, since we already removed the fallbacks in `useConnectionRequestActions`, this data is fetched but never used for agreement display. This is dead data — no code change needed, just awareness.

### 4. `auth-helpers.ts` still maps profile-level agreement booleans into User type (LOW)

Lines 123-133 map `profile.nda_signed`, `profile.fee_agreement_signed` etc. into the `User` object. Since all consumers now use firm-level data, these are effectively dead fields on the User type. No breaking change needed — can be cleaned up in a future round.

## Implementation Plan

**Single round — 3 edge function updates + deploy:**

1. **`get-buyer-nda-embed/index.ts`**: Replace `resolveFirmId()` with `supabaseAdmin.rpc('resolve_user_firm_id', ...)`. Remove profile-level self-heal writes.

2. **`get-buyer-fee-embed/index.ts`**: Same — replace `resolveFirmId()` with RPC call. Remove profile-level self-heal writes.

3. **`confirm-agreement-signed/index.ts`**: Replace `resolveFirmId()` with RPC call.

4. **Deploy** all three edge functions.

This is the last set of changes needed. After this, every path in the system — frontend hooks, edge functions, and database RPCs — will use the same canonical `resolve_user_firm_id()` resolver with zero reliance on `connection_requests.firm_id` or stale profile booleans.

