

# Remaining Issues: Full Gap Analysis

## What's Been Fixed
- `resolve_user_firm_id()` DB function rewritten (non-circular)
- `ProfileDocuments.tsx` uses canonical RPC
- `MessageCenter.tsx` uses `firm_members` directly
- `auto-create-firm-on-approval` re-resolves instead of trusting `cr.firm_id`
- `company` and `buyer_type` locked in `PRIVILEGED_FIELDS` + disabled in `ProfileForm.tsx`
- DB trigger blocks `company`/`buyer_type` changes on approved profiles
- Data cleanup migration for teltonika.lt

## What Still Needs Fixing

### 1. `useConnectionRequestFirm` reads stale `connection_requests.firm_id` (HIGH PRIORITY)
**File**: `src/hooks/admin/use-connection-request-firm.ts`

This hook reads firm info by joining `connection_requests.firm_id → firm_agreements`. If the connection request has a stale/wrong `firm_id` (the migration only fixed teltonika members, not ALL corrupted CRs), this returns wrong data.

**Used by 4 components** — all admin-facing:
- `ConnectionRequestFirmBadge.tsx` — badge showing firm name in pipeline
- `DealFirmWarning.tsx` — "this will cascade to N members" warning
- `useConnectionRequestActions.ts` — determines `hasFeeAgreement`, `hasNDA`, `ndaStatus`, `feeStatus` for the pipeline sidebar; also controls `SendAgreementDialog` visibility
- `NDASection.tsx` — renders `AgreementStatusDropdown` in connection request sidebar

**Fix**: Rewrite `useConnectionRequestFirm` to resolve via the user instead of the CR. The hook should:
1. Fetch the `user_id` from the connection request
2. Call `resolve_user_firm_id` RPC for that user
3. Then fetch firm_agreements + firm_members for the resolved firm_id

### 2. `useConnectionRequestActions` falls back to `user.nda_signed` / `user.fee_agreement_signed` (MEDIUM)
**File**: `src/components/admin/connection-request-actions/useConnectionRequestActions.ts` (lines 77-84)

```typescript
const hasFeeAgreement = firmInfo?.fee_agreement_signed || user.fee_agreement_signed || false;
const hasNDA = firmInfo?.nda_signed || user.nda_signed || false;
```

This reads legacy boolean fields from the `profiles` table. These profile-level booleans are NOT synced from `firm_agreements` — they're stale remnants. If firm resolution returns null, these stale profile booleans take over and show wrong statuses.

**Fix**: Remove the `user.*` fallbacks. Only use firm-level data. If no firm exists, status should be `not_started`.

### 3. `DualNDAToggle` and `DualFeeAgreementToggle` fall back to `user.nda_signed` / `user.fee_agreement_signed` (MEDIUM)
**Files**: `src/components/admin/DualNDAToggle.tsx` (line 35), `src/components/admin/DualFeeAgreementToggle.tsx` (line 39)

Same issue — `firm?.nda_signed ?? Boolean(user.nda_signed)`. Falls back to stale profile booleans.

**Fix**: Remove user-level fallbacks. Only show firm-level data.

### 4. `use-firm-agreement-actions.ts` `useUserFirm` duplicates the resolver (LOW)
**File**: `src/hooks/admin/use-firm-agreement-actions.ts` (lines 89-146)

This has its own manual firm resolution logic (query `firm_members`, then fall back to email domain match on `firm_agreements`). It doesn't use the canonical `resolve_user_firm_id` RPC. The logic is close but not identical — e.g., it doesn't check normalized company name at all.

**Fix**: Replace with a call to `resolve_user_firm_id` RPC, then fetch firm data.

### 5. `useRealTimeSessions` and `useEnhancedRealTimeAnalytics` read `profile.nda_signed` / `profile.fee_agreement_signed` (LOW)
**Files**: `src/hooks/useRealTimeSessions.ts` (lines 264-265), `src/hooks/useEnhancedRealTimeAnalytics.ts` (lines 313-314)

These display "trust signals" for live visitor tracking. They read stale profile-level booleans.

**Fix**: For realtime sessions, this is acceptable as a performance optimization (resolving firms for every live session would be expensive). But add a comment marking these as "approximate" trust signals.

### 6. `auth-helpers.ts` maps profile-level agreement booleans into the User type (LOW)
**File**: `src/lib/auth-helpers.ts` (lines 123-133)

Maps `profile.fee_agreement_signed`, `profile.nda_signed` etc. into the `User` object. These profile-level fields are stale and not synced from firm_agreements. This data feeds into `DualNDAToggle`, `DualFeeAgreementToggle`, `useConnectionRequestActions` fallbacks, and more.

**Fix**: These fields should be resolved from the firm at the point of use (which the toggles already attempt via `useUserFirm`). The auth-helpers mapping is fine to keep but should be understood as legacy/stale.

### 7. `SimpleNDADialog` and `SimpleFeeAgreementDialog` read `user.nda_signed` / `user.fee_agreement_signed` (LOW)
**Files**: `src/components/admin/SimpleNDADialog.tsx` (line 144), `src/components/admin/SimpleFeeAgreementDialog.tsx` (line 221)

Showing badge from stale profile booleans. These dialogs appear to be used in the Non-Marketplace Users table.

**Fix**: These should use the same `useUserFirm` pattern from the Dual toggles.

### 8. Non-marketplace `AgreementToggle` reads `user.firm_id` directly (MEDIUM)
**File**: `src/components/admin/non-marketplace/AgreementToggle.tsx` (lines 98, 176-182)

Uses `user.firm_id` (from connection_requests or inbound_leads data) to call `update_nda_firm_status` / `update_fee_agreement_firm_status`. If `firm_id` on those records is stale, updates go to the wrong firm.

**Fix**: Resolve the user's firm via the canonical resolver instead of trusting `user.firm_id`.

## Implementation Priority

**Round 1 (Critical — affects what admins see in pipeline):**
1. Rewrite `useConnectionRequestFirm` to resolve via user_id + RPC instead of CR's firm_id
2. Remove stale `user.*` fallbacks in `useConnectionRequestActions`
3. Remove stale `user.*` fallbacks in `DualNDAToggle` and `DualFeeAgreementToggle`
4. Replace manual resolver in `use-firm-agreement-actions.ts` `useUserFirm` with RPC call

**Round 2 (Cleanup — lower priority):**
5. Update `AgreementToggle.tsx` for non-marketplace users
6. Add "approximate" comments to realtime session hooks
7. Update `SimpleNDADialog` / `SimpleFeeAgreementDialog` to use firm-level data

