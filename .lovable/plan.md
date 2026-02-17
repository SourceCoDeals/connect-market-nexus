
# Complete Fix: Marketplace Listing Publishing Pipeline

## Summary of Findings

You're absolutely right -- marketplace listings have **nothing to do with remarketing or enrichment**. However, several database-level dependencies are entangled and blocking the publish flow. Here is the complete chain of everything that fires when you create and publish a listing, and what needs fixing.

## Current Trigger Chain on `listings` Table

When you INSERT a listing, these triggers fire in order:

1. **`auto_generate_deal_identifier_trigger`** (BEFORE INSERT) -- generates a deal ID. Harmless, works fine.
2. **`trg_validate_marketplace_publishing`** (BEFORE INSERT/UPDATE) -- warns if publishing without `hero_description`. Harmless, just logs a warning.
3. **`auto_enrich_new_listing`** (AFTER INSERT) -- queues for enrichment IF the listing has a website. **Now fixed** (no longer references the dropped column). Harmless for marketplace listings that don't have a website field filled in.
4. **`safe_deal_alerts_trigger`** (AFTER INSERT) -- tries to match deal alerts. Harmless, wrapped in exception handler.
5. **`trg_log_internal_deal_changes`** (AFTER UPDATE) -- logs audit trail when `is_internal_deal` changes. Harmless.

**Trigger status: All triggers are now safe.** The enrichment trigger fix we just deployed resolved the last blocker.

## Database CHECK Constraints (The Real Remaining Blocker)

The `publish-listing` edge function sets `is_internal_deal = false` on the listing. But the database has this constraint:

```
listings_marketplace_requires_image:
  is_internal_deal = true
  OR (is_internal_deal = false AND image_url IS NOT NULL AND image_url != '')
```

This means: **a listing cannot be published unless it has an image**. But the edge function's validation does NOT check for an image. So the edge function passes validation, then the database UPDATE crashes with a constraint violation.

The other constraint is fine:
```
listings_publish_required:
  is_internal_deal = true
  OR (is_internal_deal = false AND published_at IS NOT NULL)
```
The edge function already sets `published_at`, so this one passes.

## What Needs to Change

### Fix 1: Add image validation to the edge function

Add an image check to the `validateListingQuality` function in `publish-listing/index.ts` so the user gets a clear error message ("Image is required") instead of a cryptic database constraint error.

### Fix 2: Make the form enforce image upload for Marketplace listings

When creating a listing from the Marketplace tab, the form should require an image before submission. This gives immediate feedback rather than a post-creation error.

## Complete Requirements for a Listing to Auto-Publish

After these fixes, a listing created from the Marketplace tab will publish if and only if:

| Requirement | Enforced By |
|---|---|
| Title >= 5 characters | Edge function validation |
| Description >= 50 characters | Edge function validation |
| At least one category | Edge function validation |
| Location provided | Edge function validation |
| Revenue > 0 | Edge function validation |
| EBITDA provided (any number) | Edge function validation |
| Image uploaded | Edge function validation + DB constraint |
| published_at set | Edge function (auto-sets) |
| Not linked to remarketing | Edge function check |

## Technical Changes

### File 1: `supabase/functions/publish-listing/index.ts`

Add image_url check inside `validateListingQuality`:

```typescript
if (!listing.image_url || listing.image_url.trim().length === 0) {
  errors.push('An image is required for marketplace listings');
}
```

### File 2: Form component (listing editor)

Add validation when `targetType === 'marketplace'` to require an image file before allowing form submission. Show a visual indicator that image is required.

## What Does NOT Need to Change

- Enrichment triggers -- now fixed, and irrelevant to marketplace listings without a website
- Remarketing system -- completely separate; only touches listings when explicitly added via the ReMarketing module
- Deal alerts trigger -- wrapped in exception handler, won't block listing creation
- Audit logging trigger -- harmless
- The `use-robust-listing-creation.ts` and `use-create-listing.ts` hooks -- already correct with the toast fix
- The `publish-listing` edge function's publish/unpublish logic -- already correct
