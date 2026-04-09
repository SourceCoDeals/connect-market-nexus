

# Add Deal Owner Inline on Connection Request Rows

## What

Show the deal owner's name inline next to the company/listing name on each connection request row, so you can see at a glance who owns each deal (e.g. "Municipal Meter Installation & Services - Mid Atlantic/**Saks Metering** · Bill Martin").

## How It Works

The `listings` table already stores `primary_owner_id` (a UUID pointing to `profiles`). The connection requests query already batch-fetches profiles. We just need to:

1. Include `primary_owner_id` in the listing select
2. Resolve the owner name from the profiles map
3. Display it inline after the company name

## Design

After the company name, a subtle separator (` · `) followed by the owner's first name in muted text with a small user icon. Clean, minimal, no extra space:

```text
Municipal Meter Installation & Services / Saks Metering · Bill Martin
```

Styled as `text-muted-foreground text-sm font-medium` so it's visible but doesn't compete with the company name.

## Changes

| File | Change |
|------|--------|
| `src/hooks/admin/requests/use-connection-requests-query.ts` (~line 131) | Add `primary_owner_id` to the listing select string. After building `listingsById`, collect any `primary_owner_id` values not already in `profilesById` and batch-fetch them. Pass `ownerName` into the enhanced request's listing object. |
| `src/components/admin/ConnectionRequestRow.tsx` (~line 68-96, ~line 599-606) | Update `formatEnhancedCompanyName` to accept an optional `ownerName` param. Render it inline after the company name as `· {ownerName}` in muted style. Pass the owner name from `request.listing` at both call sites. |
| `src/types/admin.ts` or `src/types/index.ts` | Ensure the `Listing` type includes `primary_owner_id` (it already does) and add an optional `owner_name?: string` field for the resolved display name. |

