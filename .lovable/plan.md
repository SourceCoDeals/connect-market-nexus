
# Fix: Auto-Save Generated Guide to Supporting Documents

## Problem Summary

When the M&A Research Guide completes generation, it never appears in the Supporting Documents because:

1. **Edge function only handles storage** - `generate-guide-pdf` uploads the HTML file to Supabase Storage but doesn't update the database
2. **State-only update** - The `onDocumentAdded` callback only updates React state (`setDocuments`) 
3. **No auto-persist** - The document reference is lost on page refresh unless user manually clicks "Save"

## Current Flow (Broken)

```text
Guide completes
    │
    ▼
saveGuideToDocuments() called
    │
    ▼
Edge function uploads HTML to storage ✓
    │
    ▼
Returns document reference
    │
    ▼
onDocumentAdded() → setDocuments() (React state only)
    │
    ▼
User navigates away or refreshes → Document lost
```

## Solution: Direct Database Persistence

Modify `saveGuideToDocuments` in `AIResearchSection.tsx` to immediately persist the document to the database after the edge function succeeds, rather than relying on the parent's state-only callback.

## Implementation Plan

### Step 1: Update `saveGuideToDocuments` Function

**File:** `src/components/remarketing/AIResearchSection.tsx`

Current behavior (lines 68-106):
- Calls `generate-guide-pdf` edge function
- On success, calls the callback which only updates state
- Silently ignores errors

New behavior:
- Call edge function (unchanged)
- After success, read current documents from database
- Filter out any existing `ma_guide` type documents (avoid duplicates)
- Append the new document reference
- Write updated array back to database
- Still call callback for immediate UI update
- Show error toast on failure (not silent)

### Step 2: Add Supabase Import

Add the Supabase client import to the file if not already present:

```typescript
import { supabase } from "@/integrations/supabase/client";
```

### Step 3: Update Function Logic

Replace the `saveGuideToDocuments` helper function with:

```typescript
const saveGuideToDocuments = async (
  content: string,
  industryName: string,
  universeId: string,
  onDocumentAdded: (doc: { id: string; name: string; url: string; uploaded_at: string }) => void
) => {
  try {
    // 1. Call edge function to upload HTML to storage
    const response = await fetch(
      `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/generate-guide-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`,
        },
        body: JSON.stringify({ universeId, industryName, content }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to generate guide: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.document) {
      throw new Error(data.error || 'No document returned');
    }

    // 2. Read current documents from database
    const { data: universe, error: readError } = await supabase
      .from('remarketing_buyer_universes')
      .select('documents')
      .eq('id', universeId)
      .single();

    if (readError) {
      throw new Error(`Failed to read universe: ${readError.message}`);
    }

    // 3. Build updated documents array (replace any existing ma_guide)
    const currentDocs = (universe?.documents as any[]) || [];
    const filteredDocs = currentDocs.filter(
      d => !(d as any).type || (d as any).type !== 'ma_guide'
    );
    const updatedDocs = [...filteredDocs, data.document];

    // 4. Write back to database
    const { error: updateError } = await supabase
      .from('remarketing_buyer_universes')
      .update({ documents: updatedDocs })
      .eq('id', universeId);

    if (updateError) {
      throw new Error(`Failed to save document: ${updateError.message}`);
    }

    // 5. Update local state for immediate UI feedback
    onDocumentAdded(data.document);
    toast.success("Guide saved to Supporting Documents");

  } catch (error) {
    console.error('Error saving guide to documents:', error);
    toast.error(`Failed to save guide: ${(error as Error).message}`);
  }
};
```

### Key Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| Storage upload | Edge function | Edge function (unchanged) |
| Database write | None (state only) | Direct Supabase update |
| Error handling | Silent console.error | Visible toast.error |
| Duplicate handling | Callback filters | DB-side filter before insert |
| Persistence | Lost on refresh | Survives refresh |

### No Schema Changes Required

The `documents` column already exists as JSONB on `remarketing_buyer_universes` table and is used by `DocumentUploadSection` for manual uploads.

## Files to Modify

1. **`src/components/remarketing/AIResearchSection.tsx`** (lines 68-106)
   - Add supabase import
   - Update `saveGuideToDocuments` to persist directly to database
   - Replace silent error handling with toast notifications
