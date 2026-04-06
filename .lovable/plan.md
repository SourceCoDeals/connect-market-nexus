

# End-to-End Verification: What Was Implemented vs. What's Still Missing

## What WAS Implemented Correctly

### Phase 1: Data Mapping (DONE)
- `CreateListingFromDeal.tsx` fetches all structured fields (`services`, `geographic_states`, `number_of_locations`, `customer_types`, `revenue_model`, `business_model`, `growth_trajectory`)
- These are correctly mapped into the `prefilled` listing object (lines 149-165)
- `use-robust-listing-creation.ts` persists all of them to the database (lines 259-274)

### Phase 2: Editor Sections (DONE)
- `EditorBusinessDetailsCard.tsx` created with all 7 fields, editable with proper array handling
- `EditorVisibilityPanel.tsx` created with 3-tier visibility rules
- Both integrated into `ImprovedListingEditor.tsx` (lines 608-609)
- Form schema includes all 7 business detail fields (lines 107-113)
- `handleSubmit` passes them through (lines 527-533)

### Phase 3: Visibility Panel (DONE)
- Clear 3-tier breakdown: Admin Only, Marketplace (All Buyers), After Approval

### Phase 5: Buyer-Facing Rendering (DONE)
- `BusinessDetailsGrid.tsx` renders all 7 fields on `ListingDetail.tsx`
- `MARKETPLACE_SAFE_COLUMNS` includes all these fields

### Phase 4: Preview (PARTIALLY DONE)
- Landing Page preview (FullFidelityLandingPreview) correctly passes business details via `formValuesToLandingPageDeal` (lines 440-446)
- BUT: the "Full Listing" preview (FullListingPreview, lines 224-395) does NOT render BusinessDetailsGrid. It shows financial grid, description, and sidebar CTA but skips business details entirely.

## What's Still Missing or Broken

### Issue 1: Full Listing Preview Missing Business Details
The `FullListingPreview` component (line 224) does not render `BusinessDetailsGrid`. Buyers who click into a listing from the marketplace see business details, but the admin preview labeled "Full listing page" does not show them. This is misleading.

**Fix**: Import and render `BusinessDetailsGrid` in `FullListingPreview` using form values.

### Issue 2: Em Dashes Still Present in User-Facing Copy
Found em dashes (`—`) in several admin-facing surfaces that users see:

- `EditorDescriptionSection.tsx` line 77: `'AI listing regenerated with validation warnings — review carefully.'`
- `EditorDescriptionSection.tsx` line 79: `'Listing description regenerated — review and edit before saving.'`
- `EditorDescriptionSection.tsx` line 137: `'bullet points for key data — present information...'`
- `EditorHeroDescriptionSection.tsx` line 52: `'Hero description regenerated — review and edit before saving.'`
- `EditorFeaturedDealsSection.tsx` line 26: `return '—'` (null currency display)
- `EditorLivePreview.tsx` lines 592, 601, 613: preview tab descriptions use em dashes
- `EditorInternalCard.tsx` line 58: comment only (harmless)

**Fix**: Replace all user-facing em dashes with periods, commas, or hyphens.

### Issue 3: No Distinct Preview Modes (Public vs. Approved Buyer vs. Admin)
The plan called for preview modes showing what buyers see before vs. after connection approval (e.g., financials hidden in public mode). Currently all three preview tabs show financials openly. The "Full Listing" preview shows the financial grid without any indication that unapproved buyers cannot see it.

**Fix**: Add a visual indicator or blur/lock overlay on the financial grid in the "Card" and "Full Listing" preview tabs with a note like "Visible after connection approval only." This matches actual gating behavior without requiring complex mode switching.

## Changes

### File 1: `src/components/admin/editor-sections/EditorLivePreview.tsx`
- Import `BusinessDetailsGrid` 
- Add it to `FullListingPreview` after the description section, passing form values
- Replace 3 em dashes in preview tab descriptions with periods/commas
- Add a subtle "Gated: visible after approval" label above the financial grid in `FullListingPreview`

### File 2: `src/components/admin/editor-sections/EditorDescriptionSection.tsx`
- Line 77: `'AI listing regenerated with validation warnings. Review carefully.'`
- Line 79: `'Listing description regenerated. Review and edit before saving.'`
- Line 137: replace em dash with period

### File 3: `src/components/admin/editor-sections/EditorHeroDescriptionSection.tsx`
- Line 52: `'Hero description regenerated. Review and edit before saving.'`

### File 4: `src/components/admin/editor-sections/EditorFeaturedDealsSection.tsx`
- Line 26: `return '-'` instead of `return '—'`

## Beyond the Original Plan

Nothing critical missing. The data pipeline from deal to listing to buyer is complete. The three remaining issues above are refinements that close the gap between admin perception and buyer reality.

