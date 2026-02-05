
# Add Call Transcript Dialog Redesign

## Overview

Redesign the Add Transcript dialog to match the target design from the reference image, with a cleaner layout and three input methods (link, upload, or paste text) - all optional but at least one required.

---

## Target Design Analysis

Based on the reference image, the new dialog should have:

1. **Title** (required) - Full-width input at the top
2. **Transcript Link** (optional) - For Fireflies or any transcript URL
3. **Notes / Transcript Content** - Textarea for pasting content
4. **Call Date** (optional) - Date picker
5. **Primary Action Button** - "Add Transcript Link" with link icon
6. **OR UPLOAD FILE** - Divider with upload section below
7. **Click to upload** - Drag-and-drop style upload area

---

## Key Changes from Current Design

| Current | New |
|---------|-----|
| Source Type dropdown | Removed per user request |
| "File Name (optional)" label | Changed to "Title *" (required) |
| Side-by-side layout | Single column, stacked fields |
| Basic file upload button | Premium drag-drop upload zone |
| "Add Transcript" button | "Add Transcript Link" with icon |
| No date picker visible | Call Date input with calendar |

---

## Technical Implementation

### 1. Remove Source Type Dropdown

Since user confirmed to remove it, we'll:
- Remove the `source` field from form state
- Remove the Select component
- Set a default source value when saving (e.g., "call")

### 2. Restructure Form Layout

New layout order:
```text
┌────────────────────────────────────────┐
│ Add Call Transcript                ✕   │
├────────────────────────────────────────┤
│                                        │
│ Title *                                │
│ ┌────────────────────────────────────┐ │
│ │ E.g., Q1 2024 Buyer Call           │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Transcript Link                        │
│ ┌────────────────────────────────────┐ │
│ │ https://...                        │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Notes / Transcript Content             │
│ ┌────────────────────────────────────┐ │
│ │ Paste transcript content...        │ │
│ │                                    │ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Call Date (optional)                   │
│ ┌────────────────────────────────────┐ │
│ │ mm/dd/yyyy                     📅  │ │
│ └────────────────────────────────────┘ │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ 🔗 Add Transcript Link             │ │
│ └────────────────────────────────────┘ │
│                                        │
│           OR UPLOAD FILE               │
│                                        │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│ │          ⬆ Upload                  │ │
│ │      Click to upload               │ │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                        │
└────────────────────────────────────────┘
```

### 3. File Upload with Storage

Since user wants both file storage AND text extraction:

**For text files (.txt, .vtt, .srt):**
1. Read file content → populate transcript_text
2. Upload file to `deal-transcripts` bucket
3. Save file URL to `transcript_url` column

**For binary files (.pdf, .doc, .docx):**
1. Upload file to `deal-transcripts` bucket
2. Save file URL to `transcript_url` column
3. Leave transcript_text empty (or implement PDF parsing later)

### 4. Premium Upload Zone Design

Replace the basic button with a styled drop zone:

```tsx
<div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer">
  <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
  <p className="text-sm text-muted-foreground">Click to upload</p>
  <p className="text-xs text-muted-foreground/70 mt-1">.txt, .pdf, .doc, .vtt, .srt</p>
</div>
```

### 5. Validation Logic

At least one of these must be provided:
- Transcript Link (URL)
- Transcript Content (pasted text)
- Uploaded file

Title is always required.

---

## File Changes

### Modified File
**`src/components/ma-intelligence/AddTranscriptDialog.tsx`**

Changes:
- Remove Source Type Select component and related state
- Rename dialog title: "Add Transcript" → "Add Call Transcript"
- Reorder fields: Title → Link → Content → Date
- Add date input field with native HTML date picker
- Replace button with premium upload zone
- Add "OR UPLOAD FILE" divider
- Rename primary button: "Add Transcript" → "Add Transcript Link" with Link2 icon
- Add file upload to Supabase Storage
- Update validation messaging

---

## Premium Design Tokens

Following the established design system:

**Input styling:**
- Border: `border-amber-500/40` focus ring (matching reference)
- Background: Clean white

**Upload zone:**
- Border: `border-2 border-dashed border-muted-foreground/25`
- Hover: `hover:border-muted-foreground/50`
- Icon: Muted, centered

**Divider:**
- Text: `text-xs uppercase tracking-wide text-muted-foreground`
- Lines: `border-t border-muted` on each side

**Primary button:**
- Full width
- Amber/gold accent (matching reference)
- Icon + text

---

## Storage Integration

File upload path: `{listing_id}/{timestamp}_{filename}`

```typescript
const uploadFile = async (file: File, listingId: string) => {
  const timestamp = Date.now();
  const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${listingId}/${timestamp}_${filename}`;
  
  const { data, error } = await supabase.storage
    .from('deal-transcripts')
    .upload(path, file);
    
  if (error) throw error;
  
  const { data: { publicUrl } } = supabase.storage
    .from('deal-transcripts')
    .getPublicUrl(path);
    
  return publicUrl;
};
```

---

## Validation Summary

| Scenario | Valid? |
|----------|--------|
| Title + Link only | ✅ |
| Title + Content only | ✅ |
| Title + File only | ✅ |
| Title + Link + Content + File | ✅ |
| No title | ❌ |
| Title but no link/content/file | ❌ |
