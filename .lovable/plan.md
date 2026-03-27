

# Phase 2: Connection Request System — Remaining Fixes & Hardening

## What's Already Done (Phase 1 — Verified)

All 6 fixes from Phase 1 are confirmed implemented:
- ListingCardActions now has profile completeness, buyer type, and fee agreement gates
- ListingCard computes and passes gating props
- ListingDetail passes actual `isAdmin` value
- ConnectionButton shows "Request Again" for rejected requests
- ArchivedDeals and ValuationLeadsTable build errors fixed

## Remaining Issues to Fix

### Issue 1: FeeAgreementGate silent skip when user has no firm

**Problem**: In `ConnectionButton.tsx` (lines 213 and 249), the FeeAgreementGate only renders when `ndaStatus?.firmId` exists. If a user has no firm resolved (new user, generic email domain), `showFeeGate` becomes true but the component never mounts. The dialog just... doesn't open. The user clicks and nothing happens — no error, no feedback.

**Fix**: When `showFeeGate` is true but `firmId` is null, show an inline message telling the user to contact support or complete their company info, instead of silently failing. Add a fallback branch:

```
if (showFeeGate && (!ndaStatus?.firmId)) → show "Contact support to set up your fee agreement"
```

**File**: `src/components/listing-detail/ConnectionButton.tsx` — add fallback UI in both render locations (lines 213 and 249)

### Issue 2: NDA gate is dismissible — user can browse confidential info

**Problem**: `ListingDetail.tsx` line 57 has `ndaGateDismissed` state that lets users close the NDA gate and view deal details without signing. The "Back to listings" button in `NdaGateModal` navigates away (good), but there's no dismiss callback being passed — the `ndaGateDismissed` state must be set somewhere else or via browser back.

**Investigation**: Looking at `NdaGateModal.tsx`, it has no dismiss/close button except "Back to listings". The `ndaGateDismissed` state in `ListingDetail.tsx` is initialized to `false` and never set to `true` anywhere in the visible code. This means the gate is NOT actually dismissible — `ndaGateDismissed` is dead code. No fix needed, but should clean up the unused state.

**Fix**: Remove `ndaGateDismissed` state variable and simplify `showNdaGate` condition.

**File**: `src/pages/ListingDetail.tsx`

### Issue 3: ListingCardActions "View Deal Details" button doesn't navigate

**Problem**: The "View Deal Details" button for approved connections (line 167-172) has no `onClick` handler and no `Link` wrapper. It renders as a button that does nothing when clicked.

**Fix**: Wrap it in a `Link` to `/listing/{id}` or add an `onClick` that navigates. The component needs the listing ID as a prop.

**File**: `src/components/listing/ListingCardActions.tsx` — add `listingId` prop and wrap approved button in navigation

### Issue 4: No rate limiting on connection requests from ListingCard

**Problem**: The `use-connections.ts` mutation has no rate limiting. Users could spam-click the request button. The RPC deduplicates (merges), but each click still fires a full mutation with email notifications and quality scoring.

**Fix**: Add the existing `createDebouncedSubmission` wrapper from `src/lib/rate-limiter.ts` to the request mutation, or add a simple guard in ListingCard/ConnectionButton that disables the button for 3 seconds after submission.

**Files**: `src/components/listing/ListingCardActions.tsx` and `src/components/listing-detail/ConnectionButton.tsx` — the `isRequesting` state already disables during mutation, so this is partially handled. The real gap is rapid re-clicks before the mutation starts. Add `isPending` check — already done via React Query's `isPending`. This is actually fine. No change needed.

### Issue 5: ConnectionRequestDialog missing `listingId` from ListingCardActions

**Problem**: `ListingCardActions.tsx` line 233-239 passes `listingTitle` to `ConnectionRequestDialog` but NOT `listingId`. Without `listingId`, the AI draft button (`handleAIDraft` in the dialog) won't work — it returns early on line 61: `if (!listingId) return`.

**Fix**: Add `listingId` prop to `ListingCardActions` and pass it through to `ConnectionRequestDialog`.

**Files**: `src/components/listing/ListingCardActions.tsx` (add prop), `src/components/ListingCard.tsx` (pass `listing.id`)

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/listing-detail/ConnectionButton.tsx` | Add fallback UI when fee gate triggers but no firmId exists |
| `src/pages/ListingDetail.tsx` | Remove dead `ndaGateDismissed` state |
| `src/components/listing/ListingCardActions.tsx` | Add `listingId` prop; pass to dialog; make "View Deal Details" navigate |
| `src/components/ListingCard.tsx` | Pass `listing.id` as `listingId` to ListingCardActions |

