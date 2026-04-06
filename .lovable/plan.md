

# Add Preview Button for Final PDFs

## Problem
Final PDF documents have Download and Replace buttons but no way to preview them inline. You have to download to see them.

## Change — Single File

### `src/components/admin/data-room/MemosTab.tsx`

Add a **Preview** button to the Final PDF action row (lines 695-737), before the existing Download button. It will use the same `useDocumentUrl` hook but with `action: 'view'` (default) to get a signed URL and open it in a new browser tab.

**New button row**: `[Preview] [Download] [Replace] [Delete]`

Implementation:
- Add a `handlePreviewPdf` function that calls `documentUrl.mutate({ documentId: document.id, action: 'view' })` and opens the returned URL in a new tab
- Insert an `Eye` icon Preview button as the first item in the flex row
- Since both Preview and Download use the same `documentUrl` mutation, add a state flag (`isPreviewing`) to track which action is in progress so the correct button shows a spinner

### No other files changed.
