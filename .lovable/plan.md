

# Fix: Streamline Listing Creation to Marketplace

## Problem

Every listing created via `/admin/listings` defaults to `is_internal_deal = true`, placing it in the **Research Deals** tab. To make it public, you must then find the listing in Research, open its menu, and click "Publish to Marketplace." This two-step workflow is unintuitive when your intent is to create a public marketplace listing.

## Root Cause

Two files hardcode `is_internal_deal: true` on every create:
- `src/hooks/admin/listings/use-create-listing.ts` (line 48)
- `src/hooks/admin/listings/use-robust-listing-creation.ts` (line 137)

There is no option in the creation form or submission flow to choose the listing type.

## Solution: Auto-Publish After Creation

Rather than changing the safe default (internal draft), we add an **auto-publish step** after creation when the listing is being created from the Marketplace tab. This preserves the safety guardrails while eliminating the manual second step.

### Change 1: Pass listing type context through the creation flow

In `ListingsManagementTabs.tsx`, pass the current `activeTab` value to the form submit handler so the system knows whether the admin intended a marketplace or research listing.

### Change 2: Auto-publish for marketplace-intended listings

In `use-create-listing.ts`, after the listing is successfully created (and image uploaded), automatically call the `publish-listing` edge function if the listing was created from the Marketplace tab. This reuses the existing publish validation (title, description, image, financials) so no unvetted listing can go public.

```text
Flow for Marketplace tab:
  1. Insert listing (is_internal_deal = true) -- safe default
  2. Upload image
  3. Call publish-listing edge function -- flips is_internal_deal to false
  4. Listing appears in Marketplace tab immediately

Flow for Research tab:
  1. Insert listing (is_internal_deal = true)
  2. Upload image (optional)
  3. Done -- stays in Research tab
```

### Change 3: Update toast message based on outcome

- If auto-publish succeeds: "Listing created and published to marketplace"
- If auto-publish fails (e.g., missing required fields): "Listing created as draft in Research tab. To publish, complete the required fields and use Publish to Marketplace."

### Change 4: Update the form UI

Add a visible indicator at the top of the creation form showing which tab the listing will target:
- From Marketplace tab: "This listing will be published to the public marketplace"
- From Research tab: "This listing will be saved as an internal research deal"

## Files to Change

| File | Change |
|------|--------|
| `src/components/admin/ListingsManagementTabs.tsx` | Pass `activeTab` to `handleFormSubmit`, forward to create mutation |
| `src/hooks/admin/listings/use-create-listing.ts` | Accept optional `targetType` param; auto-call `publish-listing` edge function after creation when type is `marketplace` |
| `src/hooks/admin/listings/use-robust-listing-creation.ts` | Same auto-publish logic for the robust creation path |
| `src/components/admin/ListingForm.tsx` / `ImprovedListingEditor` | Accept and display `targetType` prop as a banner |

## Why This Is Safe

- The `is_internal_deal = true` default remains -- every listing starts as a draft
- The `publish-listing` edge function is the single gateway to marketplace visibility; it validates image, title, description, and financials before flipping the flag
- If publish validation fails, the listing stays as an internal draft with a clear message to the admin
- Research tab listings are unaffected -- no auto-publish when creating from that tab
- Database constraints (`listings_marketplace_requires_image`, `published_at`/`published_by_admin_id` audit) remain enforced

