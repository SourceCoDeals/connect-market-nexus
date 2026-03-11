

# Fix: Relax category/industry validation in seed-buyers

## Problem
The `validateDealFields` function in `supabase/functions/seed-buyers/index.ts` (lines 165-169) requires **both** `industry` AND `categories`/`category` to be present. The user wants it to only require **one or the other**, and if neither is present, the AI should infer it from the deal description before proceeding.

## Current Logic (lines 165-169)
```
if (!industry) missing.push('industry');
if (!categories && !category) missing.push('categories');
```
Both are checked independently — both must exist.

## Plan

### 1. Relax validation (line 165-169)
Change the validation so that `industry` and `categories` are checked together — only flag as missing if **neither** is present:

```typescript
const hasIndustryOrCategory =
  (deal.industry as string)?.trim() ||
  (cats && cats.length > 0) ||
  cat?.trim();
if (!hasIndustryOrCategory)
  missing.push('industry or categories');
```

### 2. Add AI inference fallback (before validation, ~line 617)
If neither `industry`, `categories`, nor `category` is populated but a description exists, call the Gemini API with a short prompt to infer a reasonable industry and category from the deal description, then patch the `deal` object in-memory before validation runs. This avoids blocking the user.

The prompt would be minimal: "Given this business description, return a JSON with `industry` (string) and `categories` (string array of 1-3 values)."

This ensures the search never fails on missing category/industry as long as there's a description to work from.

### Files to edit
- `supabase/functions/seed-buyers/index.ts` — `validateDealFields` + add AI inference block

