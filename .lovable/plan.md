

## Root Cause

The `generate-marketplace-listing` edge function **crashes on boot** with `Identifier 'margin' has already been declared` because there are two `const margin = ...` declarations in the same scope (lines 625 and 659). This is a copy-paste duplication issue — the same title-generation logic appears twice:

1. **Lines 625-636**: First block computing `margin`, `rev`, `titleDescriptor`, `generatedTitle`
2. **Lines 659-664**: Second block computing `margin` again, `rev` again, `descriptor`, `anonymousTitle`

Because the function can't even boot, every call returns a 500, which causes `CreateListingFromDeal.tsx` to fall back to the "Placeholder description — not buyer-grade" anonymizer path (line 228).

Additionally, the listing update object (lines 673-678) has duplicate `title` keys, which is also a bug — the second one silently overwrites the first.

## Fix Plan

**Single file change: `supabase/functions/generate-marketplace-listing/index.ts`**

1. **Remove the first duplicate block (lines 625-636)** — delete the `margin`, `rev`, `titleDescriptor`, `generatedTitle` declarations entirely. They are superseded by the second block which uses `regionDescriptor` (from the proper region-mapping logic earlier in the function) instead of the raw `region` variable.

2. **Keep lines 659-664** as the canonical title generation, renaming the output to `anonymousTitle` (already named that).

3. **Fix the listing update object (lines 673-678)** — remove the duplicate `title: generatedTitle` on line 677 (which no longer exists after step 1). Keep `title: anonymousTitle`.

4. **Fix line 724** — `location: region` should use `regionDescriptor` to match the anonymized region, not the raw state code.

After the code fix, **redeploy the edge function** so the running version matches the corrected source.

