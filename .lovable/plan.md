

# Simplify: Remove Auto-Publish, Promote the Publish Button

## Strategy

Instead of trying to auto-publish on creation (which is fragile and hides validation errors), simplify to:

1. **Always create listings as drafts** -- remove all auto-publish logic from both creation hooks
2. **Make the "Publish to Marketplace" action more prominent** on the listing card -- move it out of the buried dropdown into a visible button
3. **Remove the Marketplace/Research tab split for creation** -- all listings start as drafts; they become "marketplace" when you publish them

The `publish-listing` edge function already handles all validation (title, description, image, financials, categories, location) and gives clear error messages. This is the single source of truth for what's needed to go live.

## What Changes

### 1. Remove auto-publish from creation hooks

**Files:**
- `src/hooks/admin/listings/use-robust-listing-creation.ts`
- `src/hooks/admin/listings/use-create-listing.ts`

Remove the entire "Step 3: Auto-publish if created from Marketplace tab" block (~40 lines each). The `_toastAlreadyShown` flag logic also goes away since there's no longer a competing toast source. The `onSuccess` callback simplifies to always show "Listing Created as Draft".

### 2. Promote "Publish to Marketplace" button on AdminListingCard

**File:** `src/components/admin/AdminListingCard.tsx`

In the grid view's action buttons section (around line 376-438), add a prominent publish/unpublish button next to the Edit button -- not buried in the overflow dropdown. For unpublished listings, show a clear "Publish" button. For published ones, the button shows "Live" with an option to unpublish.

```
Current:  [Edit] [Toggle] [...]
                            └── Publish to Marketplace (buried)

Proposed: [Edit] [Publish to Marketplace] [Toggle] [...]
          or
          [Edit] [Live ✓]                 [Toggle] [...]
```

The dropdown still keeps the option as a fallback, but the primary action is now visible.

### 3. Remove image requirement from creation form

**File:** `src/components/admin/ImprovedListingEditor.tsx`

Remove the marketplace image validation we just added to the form's `onSubmit`. Images are still validated at publish time by the edge function -- the form doesn't need to block creation over it. Users can add the image later before publishing.

## What Does NOT Change

- The `publish-listing` edge function -- it stays exactly as-is with all validation
- The `usePublishListing` hook -- already works perfectly
- The tab structure (Marketplace vs Research) for viewing -- still useful for filtering
- Database constraints -- still enforce image requirement at publish time
- The listing editor form itself (fields, layout) -- stays the same

## Result

The workflow becomes:

```
Create listing (always a draft)
  -> Fill in details
  -> Upload image
  -> Click "Publish to Marketplace" on the card
  -> Edge function validates everything
  -> Success: listing goes live
  -> Failure: clear toast with what's missing
```

No more auto-publish race conditions, no more double toasts, no more confusing "Created as Draft" messages when you expected it to publish.

