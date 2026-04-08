

# Fix Webflow Lead Detail: Status Overflow + Marketplace User Indicator

## Problem 1: Status column overflows

The `LeadRequestActions` Status card uses `flex items-center justify-between` on each row, cramming the status indicator, labels ("Sent", "Signed"), and switches all on one line. At narrow widths (the right 1/3 column in the grid), content clips. The `min-w-[100px]` on the label group plus the status indicator plus two switch groups is too wide.

**Fix**: Stack each status row vertically — status indicator on top, toggles below. Or wrap the toggle groups to prevent overflow by using `flex-wrap` and reducing `min-w`.

Simpler approach: change the row layout from single-line `justify-between` to a stacked layout where the label+status is on top and the toggles wrap below. Also reduce the `min-w-[100px]` to `min-w-[80px]` and add `flex-wrap` to the outer flex container.

## Problem 2: No clear "Marketplace User: Yes/No" indicator

The "Lead-Only" badge on the row header is not clear enough. For Webflow leads specifically, add a clear indicator inside `WebflowLeadDetail`:

- **If matched user exists**: Already shows green "Matched to Marketplace Profile" card (good)
- **If NO matched user**: Add a small gray info card: "Not a Marketplace User — This lead does not have an existing marketplace account"

This makes it immediately obvious for guest Webflow leads.

## Changes

| File | Change |
|------|--------|
| `src/components/admin/LeadRequestActions.tsx` | Fix overflow: add `flex-wrap` to each status row's outer container, reduce `min-w`, allow toggles to wrap gracefully |
| `src/components/admin/WebflowLeadDetail.tsx` | Add "Not a Marketplace User" indicator card for guest leads (below the source banner, mirroring the green matched-user card position) |

