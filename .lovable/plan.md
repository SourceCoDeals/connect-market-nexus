

# Fix: Listing Description Not Saving + Build Errors

## Problem 1: Description HTML not persisting

**Root cause**: The `description_html` and `description_json` fields are set via `form.setValue()` but have no registered `<FormField>` component. When `form.handleSubmit()` runs through Zod, these programmatically-set values may not reliably appear in the transformed output because React Hook Form's resolver only validates/transforms fields that are part of the schema resolution path.

Additionally, when `form.handleSubmit` applies Zod transforms (e.g., `revenue` string → number, `location` array → string), the output type changes. The `description_html` field, being `z.string().optional()`, should pass through -- but the casting to `ListingFormValues` (which is `z.infer<typeof listingFormSchema>` and has `location` as `string` not `string[]`) creates type mismatch issues that may cause fields to be dropped.

**Fix**: In `handleFormSubmit` (line 436 of `ImprovedListingEditor.tsx`), after getting `formData` from `form.handleSubmit`, explicitly merge `description_html` and `description_json` from `form.getValues()` to guarantee they're included:

```typescript
const handleFormSubmit = form.handleSubmit(async (formData) => {
  // Ensure description_html/json are always included (they're set via setValue, not FormField)
  const rawValues = form.getValues();
  const enrichedData = {
    ...formData,
    description_html: rawValues.description_html,
    description_json: rawValues.description_json,
  };
  await handleSubmit(enrichedData as unknown as ListingFormValues);
}, (errors) => { /* ...existing error handler... */ });
```

## Problem 2: Pre-existing build errors (4 files)

### 2a. `src/hooks/admin/deals/useDealsList.ts` (lines 124-141)
The `deal_pipeline` table alias `as 'deals'` doesn't match Supabase types. Fix: use `untypedFrom('deal_pipeline')` pattern or cast properly.

### 2b. `src/hooks/admin/use-pipeline-core.ts` (line 160)
Missing `weightedValue` in metrics return. Fix: add `weightedValue` calculation to the metrics object.

### 2c. `src/hooks/use-buyer-introductions.ts` (line 233)
`create_deal_from_introduction` RPC not in generated types. Fix: use `supabase.rpc('create_deal_from_introduction' as any, ...)`.

### 2d. `src/hooks/use-buyer-introductions.ts` (line 257)
Unused `_legacyCreateDealFromIntroduction_DEAD` function. Fix: prefix with `// @ts-ignore` or remove entirely since it's dead code kept only for reference.

## Files to modify

| File | Change |
|------|--------|
| `src/components/admin/ImprovedListingEditor.tsx` | Merge `description_html`/`description_json` from raw values into handleSubmit output |
| `src/hooks/admin/deals/useDealsList.ts` | Fix `deal_pipeline` table typing |
| `src/hooks/admin/use-pipeline-core.ts` | Add `weightedValue` to metrics |
| `src/hooks/use-buyer-introductions.ts` | Fix RPC type + remove dead function |

