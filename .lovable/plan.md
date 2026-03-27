

# Phase 1: Fix Build Errors + Connection Request Gate Bypass

## Part A: Fix Build Errors (3 files)

### 1. `src/pages/admin/deals/ArchivedDeals.tsx`
The component queries tables that don't exist in the Supabase types:
- Uses `'deals'` → should be `'deal_pipeline'`
- Uses `'deal_pipeline_stages'` → should be `'deal_stages'`
- Uses `archive_reason` on listings → column doesn't exist; remove or use `as unknown as ArchivedListing[]`
- Uses `primary_owner` → should be `primary_owner_id`

**Fix**: Replace table names and cast queries appropriately. Remove `archive_reason` from the select and interface (or mark nullable with a fallback).

### 2. `src/pages/admin/remarketing/ValuationLeads/ValuationLeadsTable.tsx` (line 671)
Uses `lead.company_name` and `lead.first_name` — neither exists on `ValuationLead` type.
- `company_name` → `business_name`
- `first_name` → `display_name || full_name`

**Fix**: Replace property references with correct field names.

## Part B: Close Connection Request Gate Bypass

### 3. `src/components/listing/ListingCardActions.tsx`
Currently has **zero** gates — no profile completeness check, no fee agreement check, no buyer type block. Users can bypass all gates from the marketplace grid.

**Fix**: Add new props for gating state and render appropriate blocking UI instead of the request button:
- Add `isProfileComplete`, `profileCompletePct`, `isBuyerBlocked`, `isFeeCovered` props
- When profile is incomplete: show "Complete Profile" message instead of request button
- When buyer type is blocked: show "Seller Account" message
- When fee not covered: trigger a callback instead of opening dialog

### 4. `src/components/ListingCard.tsx`
Must compute and pass the new gating props to `ListingCardActions`:
- Import `useAuth`, `isProfileComplete`, `getProfileCompletionPercentage`
- Import `useMyAgreementStatus`
- Pass computed values to ListingCardActions

### 5. `src/pages/ListingDetail.tsx` (line 358)
`isAdmin={false}` hardcoded → change to `isAdmin={isAdmin}` to use the computed value from line 52.

## Part C: Fix Rejected Request UX

### 6. `src/components/listing-detail/ConnectionButton.tsx` (line 210)
Button text says "Explore other opportunities" but submits a new request for the same listing.
**Fix**: Change text to "Request Again" to match the actual action.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/deals/ArchivedDeals.tsx` | Fix table names: `deals`→`deal_pipeline`, `deal_pipeline_stages`→`deal_stages`; remove `archive_reason`; fix `primary_owner`→`primary_owner_id` |
| `src/pages/admin/remarketing/ValuationLeads/ValuationLeadsTable.tsx` | Fix `company_name`→`business_name`, `first_name`→`display_name \|\| full_name` |
| `src/components/listing/ListingCardActions.tsx` | Add profile/fee/buyer-type gate props and blocking UI |
| `src/components/ListingCard.tsx` | Compute and pass gating props to ListingCardActions |
| `src/pages/ListingDetail.tsx` | Change `isAdmin={false}` to `isAdmin={isAdmin}` |
| `src/components/listing-detail/ConnectionButton.tsx` | Fix rejected button text from "Explore other opportunities" to "Request Again" |

