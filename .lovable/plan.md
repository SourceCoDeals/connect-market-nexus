

# Investment-Grade Memo Export Redesign

## Problem

The PDF and DOCX exports look amateur:
- Browser print header/footer shows date, URL ("about:blank"), and page numbers (visible in the uploaded PDF)
- "Prepared by SourceCo Advisors - April 7, 2026" date line is unnecessary
- "CONFIDENTIAL - FOR INTENDED RECIPIENT ONLY" red disclaimer looks junior
- Center-aligned memo type label ("CONFIDENTIAL LEAD MEMO") is filler
- Section dividers (border-bottom on h2) feel like a Word template from 2005
- Logo rendered as a small circle — should be clean, professional placement

## Design Direction

Investment-grade memo style (think Lazard, Evercore CIMs):
- Clean SourceCo logo top-left, no circular crop
- Company name as the hero title, large and commanding
- Subtitle: just "Lead Memo" or "Anonymous Teaser" — no date, no "prepared by"
- Sections: clean uppercase section headers with generous spacing, no underlines
- Footer: single line "Confidential" in small muted text — not red, not screaming
- `@page` CSS hides browser print headers/footers
- No "about:blank" or timestamps anywhere

## Files Changed

### 1. `src/components/admin/data-room/MemosTab.tsx` — PDF export (`handleDownloadDraftPdf`)
Lines 461-497. Complete rewrite of the HTML template:
- Add `@page { margin: 1in; }` with margin boxes set to empty strings to suppress browser headers/footers
- Remove date line, remove "Prepared by" line
- Logo top-left as clean image (not circular)
- Company name as large title
- "Lead Memo" or "Anonymous Teaser" as small subtitle
- Clean section headers: uppercase, letterspaced, no border-bottom
- Footer: small gray "Confidential" text, no red, no all-caps screaming

### 2. `src/components/admin/data-room/MemosPanel.tsx` — PDF export (`handleExportPdf`)
Lines 118-211. Same template rewrite as above — this is the older MemosPanel export used on a different view. Same design treatment.

### 3. `src/lib/generate-memo-docx.ts` — DOCX export
Full rewrite of the document structure:
- Remove date paragraph entirely
- Remove "CONFIDENTIAL LEAD MEMO" centered label
- Remove red confidential disclaimer banner
- Logo + "SOURCECO" letterhead stays but cleaner (thinner bottom border)
- Company name as document title
- "Lead Memo" or "Anonymous Teaser" as small subtitle
- Section headings: clean, no bottom borders
- End of document: single small gray "Confidential" line

### 4. Build error fixes (unrelated but blocking)
- `src/pages/admin/remarketing/GPPartnerDeals/types.ts` — remove duplicate `executive_summary`
- `src/pages/admin/remarketing/SourceCoDeals/types.ts` — remove duplicate `executive_summary`
- `src/components/remarketing/BulkEmailDialog.tsx` — fix property access
- `src/components/remarketing/EmailPreviewDialog.tsx` — fix property access
- `src/pages/admin/remarketing/ReMarketingDealDetail/OverviewTab.tsx` — remove unused import

## PDF Template (shared by both MemosTab and MemosPanel)

```text
+------------------------------------------+
|  [Logo]  SOURCECO                        |
|                                          |
|  Company Name                            |
|  Lead Memo                               |
|                                          |
|  COMPANY OVERVIEW                        |
|  Body text...                            |
|                                          |
|  FINANCIAL SNAPSHOT                       |
|  - Revenue: $12M                         |
|  - EBITDA: $2.3M                         |
|                                          |
|  ...more sections...                     |
|                                          |
|  Confidential                            |
+------------------------------------------+
```

Key CSS: `@page { margin: 1in; @top-left { content: ''; } @top-right { content: ''; } @bottom-left { content: ''; } @bottom-right { content: ''; } }` — this suppresses Chrome's default print header/footer (date, URL, page number).

## Implementation Order

1. Fix build errors (5 files)
2. Rewrite MemosTab PDF template
3. Rewrite MemosPanel PDF template
4. Rewrite generate-memo-docx

