

# Fix Webflow Lead Workflow + Badge Improvements

## Bug Found: Guest Webflow Leads Have No Action Buttons

In `ConnectionRequestRow.tsx` lines 643-644, when a Webflow lead has no matched user, only `<WebflowLeadDetail>` renders — **no accept/decline/on hold/flag buttons**. The `LeadRequestActions` component (which has those buttons) is never shown.

**Fix**: Add `<LeadRequestActions request={request} />` below `<WebflowLeadDetail>` for guest Webflow leads (line 643-644 branch).

## Webflow Leads Are Flowing Correctly

The edge function is processing new submissions successfully. Latest lead (Brian Underkofler) was ingested at 17:10 UTC with correct slug matching, listing association, and admin notification. All 15 Webflow leads are in the database.

## Accept/Decline Code Path Verification

Both `useUpdateConnectionRequestStatus` and `useConnectionRequestsMutation` operate on `connection_requests` by `id` — they don't filter by `source` or require a `user_id`. So accepting/declining a Webflow lead works identically to a marketplace request at the database level. The only gap was the missing UI buttons for guest leads (fixed above).

## UI: Add Tooltip to "Marketplace" Badge + Make Both Badges More Prominent

**SourceBadge.tsx** currently renders plain `<Badge>` components without tooltips. Changes:

1. Wrap the `SourceBadge` in a `Tooltip` for both `marketplace` and `webflow` (and optionally all sources)
2. Marketplace tooltip: *"This request was submitted through the SourceCo Marketplace by a registered user."*
3. Make both the "Lead-Only" and "Marketplace" badges more visually prominent:
   - **Marketplace**: Use a stronger green tint (`bg-emerald-500/15 text-emerald-700 border-emerald-500/30`) with a `ShoppingBag` or `Store` icon instead of the current muted gray
   - **Lead-Only**: Use a stronger amber/orange tint (`bg-amber-500/15 text-amber-700 border-amber-500/30`) to clearly signal external origin
   - **Webflow**: Keep the existing blue styling

## Changes

| File | Change |
|------|--------|
| `src/components/admin/ConnectionRequestRow.tsx` | Line 643-644: Add `<LeadRequestActions>` below `<WebflowLeadDetail>` for guest Webflow leads |
| `src/components/admin/SourceBadge.tsx` | Wrap badge in Tooltip; update marketplace styling to emerald green; add descriptive tooltip text per source |
| `src/components/admin/ConnectionRequestRow.tsx` | Update "Lead-Only" badge styling from neutral `outline` to amber tint for prominence |

