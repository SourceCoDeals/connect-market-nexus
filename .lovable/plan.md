

# Fix Deal Owner Source + Add Tooltip

## Problem

The current implementation resolves the owner from `listings.primary_owner_id`, but the actual "Deal Owner" shown in Active Deals comes from `listings.deal_owner_id`. For Saks Metering, the deal owner is Bill Martin (set via `deal_owner_id`), but `primary_owner_id` may point to someone else or be null.

Additionally, the owner name has no tooltip — user needs visual affordance and context about where the name comes from.

## Changes

| File | Change |
|------|--------|
| `src/hooks/admin/requests/use-connection-requests-query.ts` | Add `deal_owner_id` to listing select (line 131). Change owner resolution logic (lines 146-194) to prefer `deal_owner_id` over `primary_owner_id`. |
| `src/components/admin/ConnectionRequestRow.tsx` | Wrap the owner badge in a `Tooltip` showing "Deal Owner (from Active Deals)". Add dotted underline + Info icon to signal tooltip availability. Import `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` and `Info` icon. |

## Design

```text
Full-Stack Fire Sprinkler - Southeast  · 👤 Bill Martin ⓘ
                                         ^^^^^^^^^^^^^^^^^^^
                                         dotted underline, muted color
                                         tooltip: "Deal Owner (from Active Deals)"
```

- Muted text with dotted underline border
- Small `Info` icon (h-3 w-3) after name
- `cursor-help` on hover
- Tooltip reads: "Deal Owner — assigned in Active Deals"

