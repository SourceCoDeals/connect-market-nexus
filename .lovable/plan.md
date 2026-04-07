

# Investor-Ready Lead Memo: Clean Copy + Discrepancy Panel

## Problem

The current prompt tells Claude to inline discrepancy notes directly in the memo body (e.g., "Revenue of $6,250,000 is stated in the call transcript (Call 3). The EBITDA figure of $650,000 appears in enrichment data only; no owner confirmation..."). This makes the memo look like an analyst's working paper, not a document you can share with an investor.

Two things need to change:
1. **The memo itself must be clean** - use the highest-priority verified figure, no inline source citations or doubt language
2. **Discrepancies and data notes must be returned separately** - shown in a collapsible panel in the admin UI, never in the exported PDF/DOCX

## Changes

### 1. Edge Function: `generate-lead-memo/index.ts` - Prompt Rewrite

**System prompt changes (lines 1141-1200):**
- Remove the conflict rule that says `"Owner stated $X; [other source] shows $Y."` - this leaks analyst notes into the memo
- Replace with: "Use the highest-priority source figure. Do not cite sources, do not qualify figures, do not add notes about data provenance in the memo body."
- Remove the rule about noting "This memo is based on enrichment data and manual entries only" at the top
- Remove the rule about flagging non-reconciling figures inline

**Add a new instruction block for a separate discrepancies output:**
- After generating the memo markdown, ask Claude to output a second section `## ANALYST NOTES` (separated by a delimiter like `---ANALYST-NOTES---`) containing:
  - Data conflicts between sources (with specific source references)
  - Figures that could not be verified from transcripts
  - Missing data that would strengthen the memo
  - Any reconciliation issues (e.g., monthly x 12 != stated annual)

**User prompt changes (line 1202-1216):**
- Remove "Flag conflicts between sources" instruction
- Add: "After the memo, output `---ANALYST-NOTES---` followed by a bulleted list of any data discrepancies, unverified figures, or source conflicts you identified. If none, output `---ANALYST-NOTES---` followed by `None.`"

**Parsing changes:**
- After `parseMarkdownToSections()`, split on the `---ANALYST-NOTES---` delimiter
- Parse the analyst notes into a string field
- Store in `MemoContent` as a new `analyst_notes` field
- Pass through to the `lead_memos` table via the `content` JSON column (no schema migration needed - it's JSONB)

### 2. Edge Function: Response includes analyst_notes

The response already returns the full `content` JSONB. Since `analyst_notes` will be a new field inside it, no response format change is needed. The frontend just reads `content.analyst_notes`.

### 3. Frontend: `MemosTab.tsx` - Discrepancy Panel in Draft Preview

**In `PreviewDialog` / `DraftPreview` component (lines 825-950):**
- After the memo sections, check if `content.analyst_notes` exists and is non-empty
- If present, render a collapsible `<Collapsible>` section titled "Analyst Notes - Data Quality Findings"
- Style: muted background, amber/yellow accent, clearly separated from the memo body
- Content: render the analyst notes as formatted text (bullet points)
- This panel is admin-only, never appears in PDF/DOCX exports

### 4. Ensure PDF/DOCX exports exclude analyst_notes

The `buildMemoPdfHtml` (memo-pdf-template.ts) and `generateMemoDocx` (generate-memo-docx.ts) already filter sections by key and only render sections from the `sections` array. Since `analyst_notes` is a separate top-level field (not in the sections array), it will automatically be excluded from exports. No changes needed.

### 5. Also update the `sectionsToHtml` function in the edge function

The `sectionsToHtml` function (line 1652) generates the `html_content` stored in the DB. This is used for the in-app preview. It currently renders the red confidential disclaimer and date. Since we already redesigned the PDF template, we should also:
- Remove the red "CONFIDENTIAL" disclaimer from `sectionsToHtml`
- Remove the date line
- Keep the HTML clean for in-app display

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-lead-memo/index.ts` | Rewrite prompt to separate clean memo from analyst notes; parse `---ANALYST-NOTES---` delimiter; add `analyst_notes` to MemoContent; clean up `sectionsToHtml` |
| `src/components/admin/data-room/MemosTab.tsx` | Add collapsible "Analyst Notes" panel below draft preview sections |

## Implementation Order

1. Update edge function prompt + parsing
2. Add analyst notes panel to MemosTab preview
3. Deploy edge function

