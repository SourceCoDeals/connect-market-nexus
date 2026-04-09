

# Fix Deal Owner Resolution + Add "No Owner" State with Inline Assignment

## Problem 1: Wrong owner showing

For "Full-Stack Fire Sprinkler - Southeast", the code falls back to `primary_owner_id` (Adam Haile) when `deal_owner_id` is NULL. But Active Deals only uses `deal_owner_id` for the "Deal Owner" column. `primary_owner_id` is a different concept (the primary contact/originator). The fallback to `primary_owner_id` is showing misleading data.

**Fix**: Only use `deal_owner_id` (and its source_deal chain). Remove `primary_owner_id` from the owner resolution entirely.

## Problem 2: No owner = nothing shown

When there's no deal owner (like Protegrity Restoration), the row shows nothing — no indication that an owner is missing. You want to see "No owner" explicitly, with the ability to assign one directly.

## Changes

### 1. `src/hooks/admin/requests/use-connection-requests-query.ts`
- **Remove `primary_owner_id` from the owner resolution fallback chain** (lines 212, 221)
- Resolution becomes: `listing.deal_owner_id` → (if null) follow `source_deal_id` → `sourceListing.deal_owner_id` → done
- When no owner is found at all, set `listing.owner_name = null` and `listing.owner_source = 'none'`
- Also pass `listing.listing_id_for_assignment` — the listing ID where `deal_owner_id` should be set (either the direct listing or the source deal listing, whichever is the canonical Active Deal)

### 2. `src/components/admin/ConnectionRequestRow.tsx`
- Update `formatEnhancedCompanyName` to handle three states:
  - **Has owner**: Show `· Bill Martin ⓘ` with tooltip (as now, but only from `deal_owner_id`)
  - **No owner**: Show `· No owner` in amber/warning text with a small "Assign" button/link
- When "Assign" is clicked, open the existing `AssignOwnerDialog` component (already built, see above)
- On confirm, update `deal_owner_id` on the correct listing, invalidate queries

### 3. `src/types/admin.ts` and `src/types/index.ts`
- Update `owner_source` type to `'direct' | 'inherited' | 'none'`
- Add optional `owner_listing_id?: string` to the Listing type (the listing ID to update when assigning)

## Design

```text
With owner:
  Saks Metering · Bill Martin ⓘ
                  ^^^^^^^^^^^^
                  muted, dotted underline, tooltip: "Deal Owner — assigned in Active Deals"

No owner:
  Protegrity Restoration · No owner [Assign]
                           ^^^^^^^^  ^^^^^^
                           amber     small text button, opens AssignOwnerDialog
```

## File summary

| File | Change |
|------|--------|
| `src/hooks/admin/requests/use-connection-requests-query.ts` | Remove `primary_owner_id` from owner resolution. Only use `deal_owner_id` chain. Track which listing ID to assign to. |
| `src/components/admin/ConnectionRequestRow.tsx` | Handle "no owner" state with amber text + Assign button. Import and use `AssignOwnerDialog`. Wire up assignment mutation to update `deal_owner_id` and invalidate queries. |
| `src/types/admin.ts` | Add `owner_source: 'none'` option, add `owner_listing_id?: string` |
| `src/types/index.ts` | Same type updates |

