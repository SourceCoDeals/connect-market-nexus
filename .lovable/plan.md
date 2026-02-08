
## Multi-File Transcript Upload for Add Deal Dialog

### What Changes
The "Add New Deal" dialog currently only supports a single transcript file. This update will allow selecting and uploading multiple transcript files at once.

### UI Changes
- The file input will accept multiple files (`multiple` attribute)
- Instead of showing one file, a list of selected files will be displayed with individual remove buttons
- A file count indicator (e.g., "3 files selected") for clarity
- The transcript link input remains as-is (links and files can coexist since they serve different purposes)

### Upload Logic Changes
- `transcriptFile` (single `File`) becomes `transcriptFiles` (array of `File[]`)
- On deal creation, each file is uploaded and inserted as a separate `deal_transcripts` row (with a 2-second delay between files to avoid rate-limiting the AI parser, consistent with the existing pattern elsewhere in the app)
- PDF/DOC/DOCX files are routed through the `parse-transcript-file` edge function for text extraction before insertion
- Duplicate detection: files with the same normalized name are skipped

### Technical Details

**File: `src/components/remarketing/AddDealDialog.tsx`**

1. Change state from `useState<File | null>(null)` to `useState<File[]>([])`
2. Update `handleFileChange` to append files to the array (and dedupe by name)
3. Update `clearFile` to remove a specific file by index
4. Update the file input to include `multiple`
5. Render a list of selected files instead of a single file chip
6. In `onSuccess`, loop through all files with a delay between each, uploading to storage and inserting transcript records
7. For PDF/DOC/DOCX files, call `parse-transcript-file` to extract text before saving

No database or backend changes needed -- the `deal_transcripts` table already supports multiple rows per listing.
