
# Fix: Remove Invalid `created_by` Field from CSV Import

## Problem Identified

The CSV import is failing with the error:
> "Could not find the 'created_by' column of 'listings' in the schema cache"

This happens because **both CSV import components are trying to insert a `created_by` field that doesn't exist in the `listings` table**.

## Root Cause

| File | Line | Issue |
|------|------|-------|
| `src/components/remarketing/DealCSVImport.tsx` | 179, 189 | Includes `created_by: user?.id` in insert |
| `src/components/remarketing/DealImportDialog.tsx` | 217-219 | Includes `created_by: user?.id` in insert |

The `listings` table schema (verified in `types.ts` lines 3298-3453) does not have a `created_by` column. The table tracks ownership differently via `primary_owner_id` or `presented_by_admin_id`.

## Solution

Remove the `created_by` field from both import components since it doesn't exist in the database schema.

## Files to Modify

### 1. `src/components/remarketing/DealCSVImport.tsx`

Remove `created_by` from the type definition and initial object:

```typescript
// Line 179: Remove from type definition
// created_by?: string;  // DELETE THIS LINE

// Lines 187-191: Remove from initial object
const listingData = {
  is_active: true,
  // created_by: user?.id,  // DELETE THIS LINE
  category: "Other",
};
```

### 2. `src/components/remarketing/DealImportDialog.tsx`

Remove `created_by` from the initial object:

```typescript
// Lines 217-221: Remove from initial object
const listingData: Record<string, any> = {
  is_active: true,
  // created_by: user?.id,  // DELETE THIS LINE
  status: 'active',
};
```

## Why This Happened

The `created_by` pattern is used in other tables in the system (like `deal_documents`, `deal_transcripts`, `remarketing_outreach`, etc.), but the `listings` table predates this pattern and uses different ownership tracking fields. The import code was likely copied from another component that uses `created_by`.

## Expected Result

After this fix:
- CSV imports will successfully insert deals into the `listings` table
- All 17+ rows that were failing will import correctly
- The enrichment pipeline will trigger for newly imported deals
