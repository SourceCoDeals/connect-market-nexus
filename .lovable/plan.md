

# Fix: Deploy Edge Function and Eliminate Double-Toast

## What's Wrong

1. **Edge function not deployed**: The code fix (returning HTTP 200 instead of 400 for validation failures) was saved to the file but the edge function was never redeployed. The live function still returns 400, which makes `supabase.functions.invoke` throw an error before the client can read the validation details.

2. **Double-toast on failure**: When auto-publish fails, two toasts appear:
   - First: "Created as Draft — Listing saved to Research tab. To publish: ..." (from auto-publish handler)
   - Second: "Listing Created as Draft — use Publish to make it visible" (from onSuccess callback)
   The second toast overwrites the first, hiding the actionable validation message.

## Publishing Requirements

For a listing to auto-publish to the marketplace, it must meet ALL of these:
- Title at least 5 characters
- Description at least 50 characters
- At least one category
- Location provided
- Revenue is a positive number
- EBITDA is provided (can be zero or negative)
- Not linked to remarketing systems

If all conditions are met and the listing was created from the Marketplace tab, it will auto-publish immediately.

## Fixes

### Fix 1: Deploy the edge function
Redeploy `publish-listing` so the 200-status fix goes live. No code changes needed -- the file is already correct.

### Fix 2: Prevent double-toast in `use-robust-listing-creation.ts`

Track whether an auto-publish toast was already shown, and skip the generic `onSuccess` toast in that case. The mutation function will set a flag on the returned data to indicate the toast was already handled.

**In the mutationFn** (around line 260-296): When an auto-publish toast is shown (success or failure), mark the result so onSuccess knows not to show another toast.

**In onSuccess** (line 305-326): Check if the auto-publish path already showed a toast, and skip the duplicate.

### Fix 3: Same double-toast fix in `use-create-listing.ts`

Apply the same pattern to the legacy creation hook for consistency, since both hooks have identical auto-publish + onSuccess toast logic.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/publish-listing/index.ts` | Deploy only (code already correct) |
| `src/hooks/admin/listings/use-robust-listing-creation.ts` | Add flag to prevent double-toast when auto-publish already showed feedback |
| `src/hooks/admin/listings/use-create-listing.ts` | Same double-toast fix for consistency |

