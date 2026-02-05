
# Comprehensive Fix: Marketplace/Remarketing Data Isolation

## Root Cause Analysis

### Problem 1: "SHORELINE AUTO BODY" showing on marketplace
- This is a remarketing deal (no image, created via CSV import on 2026-02-05 at 05:24)
- It accidentally has `is_internal_deal = false` and `published_at` set
- **Why it happened**: The earlier restoration migration (Step 4) restored ALL listings with ANY marketplace engagement (including just 1 analytics view), regardless of whether they had images
- This deal has 1 analytics record (someone viewed it) but 0 connection requests, 0 saves

### Problem 2: Marketplace showing only 19 listings instead of ~74
- There are **81 total listings with images** (admin-created)
- Of these, **62 are currently `is_internal_deal = false`** (marketplace-visible)
- But only **18 are both `active` status AND `is_internal_deal = false`**
- Many admin-created listings were set to `archived` or `inactive` status
- Some admin-created listings (11) are `is_internal_deal = true` without remarketing links - these got incorrectly marked internal

### Problem 3: Remarketing deals appearing in /admin/listings
- The admin listings query (`use-listings-query.ts`) does NOT filter by `is_internal_deal`
- It shows ALL listings, including the 55 remarketing deals (no images)
- This pollutes the admin listings management interface

### Data Summary
| Category | Count |
|----------|-------|
| Total listings with images (admin-created) | 81 |
| Currently marketplace-visible (active + `is_internal_deal=false`) | 18 |
| Listings with images, internal, NOT in remarketing (should be publishable) | 11 |
| Remarketing deals (no images, internal) | 55 |
| Leaked remarketing deal showing publicly (SHORELINE AUTO BODY) | 1 |

---

## Solution Plan

### Phase 1: Database Fixes (Migrations)

#### 1.1 Fix the leaked remarketing deal
Force `is_internal_deal = true` for "SHORELINE AUTO BODY" (id: `9f9a33f0-cbc2-4888-b9c8-439cdecc50b0`) and any other listings without images that are currently public.

```sql
-- Fix leaked remarketing deals: any listing without image should NEVER be public
UPDATE public.listings
SET 
  is_internal_deal = true,
  published_at = NULL,
  published_by_admin_id = NULL
WHERE (image_url IS NULL OR image_url = '')
  AND is_internal_deal = false;
```

#### 1.2 Ensure all admin-created listings (with images) can be published
For listings with images that are NOT linked to remarketing, ensure they can be made visible. But we won't auto-publish them - we'll let the admin explicitly choose via the Publish button.

The 62 listings already marked `is_internal_deal = false` with images will remain visible. The 11 with images that are `is_internal_deal = true` but not in remarketing are admin drafts - they can be published via the Publish button.

#### 1.3 Add database constraint: no imageless listings can be public
Add a CHECK constraint to enforce this at the database level:

```sql
ALTER TABLE public.listings
ADD CONSTRAINT listings_marketplace_requires_image
CHECK (
  is_internal_deal = true 
  OR (is_internal_deal = false AND image_url IS NOT NULL AND image_url != '')
);
```

---

### Phase 2: Frontend Fixes

#### 2.1 Filter remarketing deals out of admin listings
Update `use-listings-query.ts` to only show marketplace-type listings:
- Add filter: `.eq('is_internal_deal', false)` OR filter by `image_url IS NOT NULL`
- Recommended approach: Filter to show only listings WITH images (since all admin-created listings have images)

```typescript
// In use-listings-query.ts
let query = supabase
  .from('listings')
  .select('*, hero_description')
  .is('deleted_at', null)
  .not('image_url', 'is', null)  // Only show listings with images (admin-created)
  .neq('image_url', '');         // Exclude empty string images
```

#### 2.2 Add a "Publish to Marketplace" button in admin listings
Since new listings are created as drafts (`is_internal_deal = true`), admins need an explicit "Publish" action. Wire up the existing `publish-listing` edge function to a button in the admin UI.

Changes needed in:
- `AdminListingCard.tsx` - Add "Publish" / "Unpublish" button for draft listings
- Or in the listing form after creation

---

### Phase 3: Protection Layers

#### 3.1 Strengthen remarketing deal creation
All remarketing paths already set `is_internal_deal = true`:
- `AddDealToUniverseDialog.tsx` - line 260 sets `is_internal_deal: true`
- `DealCSVImport.tsx` - line 179 sets `is_internal_deal: true`
- `DealImportDialog.tsx` - line 234 sets `is_internal_deal: true`
- `use-robust-listing-creation.ts` - line 137 sets `is_internal_deal: true`

This is correct and working.

#### 3.2 Database trigger protection
The existing trigger `mark_listing_as_internal_deal()` prevents published listings from being internalized. This is correct - it only affects unpublished listings that get linked to remarketing.

---

### Implementation Order

1. **Migration**: Fix SHORELINE AUTO BODY and add image constraint
2. **Frontend**: Update admin listings query to filter out imageless listings
3. **Frontend**: Add Publish button to admin listing cards
4. **Test**: Verify marketplace shows correct listings, admin shows only admin listings

---

### Expected Outcome After Fix

| Metric | Before | After |
|--------|--------|-------|
| Marketplace listings (active) | 19 (includes 1 leak) | 18 (correct) |
| Admin listings shown | All 136 including remarketing | Only 81 with images |
| Remarketing deals visible publicly | 1 | 0 |
| Protection against future leaks | Partial | Full (DB constraint) |

---

### Preserving Data Integrity

All changes preserve:
- Connection requests (linked by `listing_id`)
- Saved listings (linked by `listing_id`)
- Pipeline/deals workflow
- Listing analytics
- User engagement data

No IDs are changed, no data is deleted - only the `is_internal_deal` flag is adjusted for the leaked deal.
