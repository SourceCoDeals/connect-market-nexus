

# Fix Admin Attribution Display + Sort Order

## Issues

1. **No admin attribution visible**: When an admin clicks "Mark Signed", the mutation records `signed_toggled_by_name` in `document_requests`, but the table only shows the signer's name (`nda_signed_by_name`). Admins cannot see WHO on the team processed the signing.

2. **Sort is inverted**: The default sort (`last_requested`, descending) has a logic bug. The base comparison already sorts most-recent-first (`bDate - aDate`), but the `sortAsc: false` default inverts it, pushing pending requests to the BOTTOM instead of the top.

## Changes

### 1. `src/pages/admin/DocumentTrackingPage.tsx` — Show admin attribution in date cells

In the NDA Date and Fee Date cells (lines 805-827), when a document is signed, show who the admin was that toggled it. This requires:
- Adding `nda_signed_toggled_by_name` and `fee_agreement_signed_toggled_by_name` to the `FirmRow` type
- Fetching these from `document_requests` in the query (join the most recent signed request per firm+type)
- Displaying below the signer name: "Marked by [Admin Name]" in smaller muted text

**Simpler approach**: The `agreement_audit_log` already stores `changed_by_name` for every status change. The audit log is already fetched when a row is expanded. For the collapsed row, we can show the admin name from the `document_requests` table. But since `document_requests.signed_toggled_by_name` is already populated by the mutation, we just need to fetch it.

- Update `useAllFirmsTracking` query to also fetch the latest `document_requests` per firm where `status = 'signed'` and grab `signed_toggled_by_name`
- Add a small "Marked by [name]" line under the signed date

### 2. `src/pages/admin/DocumentTrackingPage.tsx` — Fix sort order

Line 446: `return sortAsc ? cmp : -cmp;`

For `last_requested`, the base `cmp` already computes `bDate - aDate` (most recent first). When `sortAsc` is false (default), this gets inverted to oldest-first.

**Fix**: Change default `sortAsc` to `true` (line 283), OR fix the sort logic so that `last_requested` and `last_signed` compute `aDate - bDate` as the base (ascending = oldest first), which means descending = most recent first. The latter is more correct.

Change lines 430 and 444 from `cmp = bDate - aDate` to `cmp = aDate - bDate` so that:
- `sortAsc: true` = oldest first (ascending)
- `sortAsc: false` = most recent first (descending, the default)

This makes pending requests sort to the top by default.

### 3. `src/pages/admin/DocumentTrackingPage.tsx` — Secondary sort: pending first

Add a secondary sort that always puts `hasPendingRequest` rows above non-pending rows, regardless of the primary sort field. Insert before the primary sort comparison:
```
if (a.hasPendingRequest !== b.hasPendingRequest) return a.hasPendingRequest ? -1 : 1;
```

## Files Changed
- **`src/pages/admin/DocumentTrackingPage.tsx`** — Fix sort direction for `last_requested`/`last_signed`, add pending-first secondary sort, show admin attribution in signed date cells via `document_requests` lookup

