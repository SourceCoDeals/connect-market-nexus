

# Fix: Newly Created Listings Invisible in Admin

## Root Cause

The admin listing tabs use a **flawed two-bucket classification** that creates a gap:

| Tab | Filter Logic | Your Listing |
|-----|-------------|--------------|
| Marketplace | `is_internal_deal = false` AND has image | `is_internal_deal = true` -- EXCLUDED |
| Research | `is_internal_deal = true` AND no image | Has image -- EXCLUDED |

New listings created via the admin form default to `is_internal_deal = true` (correct safety behavior) and can have images attached. This combination matches **neither tab**, making them invisible.

## The Fix

The Research/Internal tab filter is wrong. Internal deals should show regardless of image status. The image filter was originally meant to separate "admin-quality listings" from "data-only research imports," but it creates this blind spot.

### Change 1: Fix `use-listings-by-type.ts`

Remove the image-based exclusion from the research/internal tab. Internal deals should show whether or not they have an image.

```text
// BEFORE (line 52-56):
query = query
  .eq('is_internal_deal', true)
  .or('image_url.is.null,image_url.eq.');

// AFTER:
query = query
  .eq('is_internal_deal', true);
```

### Change 2: Fix `useListingTypeCounts` in the same file

Update the research count query (lines 135-141) to match:

```text
// BEFORE:
supabase
  .from('listings')
  .select('id', { count: 'exact', head: true })
  .is('deleted_at', null)
  .or('image_url.is.null,image_url.eq.')
  .eq('is_internal_deal', true)

// AFTER:
supabase
  .from('listings')
  .select('id', { count: 'exact', head: true })
  .is('deleted_at', null)
  .eq('is_internal_deal', true)
```

### Change 3: Fix the older `use-listings-query.ts`

Remove the image requirement filter (lines 45-46) since it creates the same blind spot for any code paths still using this hook:

```text
// REMOVE these two lines:
.not('image_url', 'is', null)
.neq('image_url', '')
```

## Why This Is Safe

- The `is_internal_deal` flag is the authoritative visibility control, not the image URL
- The publish-listing edge function already validates image presence before publishing to the marketplace
- Marketplace tab still requires `is_internal_deal = false` (only set via the publish flow), so no unvetted listings leak to buyers
- Internal/draft listings with images simply appear in the Research/Internal tab where admins can manage and eventually publish them

## Summary

| File | Change |
|------|--------|
| `src/hooks/admin/listings/use-listings-by-type.ts` | Remove `.or('image_url.is.null,image_url.eq.')` from research query and count query |
| `src/hooks/admin/listings/use-listings-query.ts` | Remove `.not('image_url', 'is', null)` and `.neq('image_url', '')` filters |

