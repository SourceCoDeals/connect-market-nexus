

# Add "AI Generate All" to Listing Editor

## Problem

The editor has fragmented AI generation: separate per-field "Generate with AI" buttons that call `generate-lead-memo` (wrong function), and separate "Regenerate with AI" buttons on hero/description that call `generate-marketplace-listing` (requires a completed lead memo). There is no single "Generate All Content" action that intelligently pulls deal data and populates everything at once.

For deals from the remarketing queue (no lead memo yet), the existing `generate-marketplace-listing` function fails because it requires a completed lead memo. The per-field `handleAiGenerate` calls `generate-lead-memo` with wrong parameters and rarely produces useful output.

## Solution

### 1. New Edge Function: `generate-listing-content`

A new edge function that generates all listing content directly from deal data (no lead memo required). It reads the deal record from `listings` table (enrichment data, transcripts, notes, description, executive summary) and generates:

- **title**: Anonymous, formatted title
- **hero_description**: 2-3 sentence elevator pitch
- **description_html**: Full rich-text body with H2 sections
- **description** (plain text markdown)

Key AI prompt rules:
- No em dashes, en dashes anywhere. Use hyphens or commas.
- Crystal clear, concrete copy. No fluff, no banned words.
- Fully anonymized (same rules as `generate-marketplace-listing`)
- Rationalize what to include: only include sections with real data. If transcripts/notes are thin, produce a shorter but factual listing rather than padding with generic language.
- Pull from: deal description, executive summary, enrichment data, transcripts, internal notes, financial data, service mix, customer types, growth drivers, etc.
- If a lead memo exists, prefer it as the primary source (same as current flow). If not, build directly from raw deal data.

### 2. Update Editor: Single "AI Generate All" Button

**File: `src/components/admin/ImprovedListingEditor.tsx`**

Add a prominent "AI Generate All Content" button at the top of the editor (below the publish banner, above the image). This button:
- Calls `generate-listing-content` with the `deal_id`
- On success, populates: `title`, `hero_description`, `description_html`, `description`, and `location`
- Shows a loading state with progress text
- Replaces the current broken `handleAiGenerate` function

Keep the individual "Regenerate with AI" buttons on hero and description sections (they call `generate-marketplace-listing` for re-generation after a lead memo exists), but fix them to also fall back to `generate-listing-content` when no lead memo is available.

### 3. Edge Function Implementation Details

**File: `supabase/functions/generate-listing-content/index.ts`**

```
POST body: { deal_id: UUID, listing_id?: UUID }
```

Flow:
1. Auth check (admin only)
2. Try to find a completed lead memo for the deal. If found, use `generate-marketplace-listing` logic (reuse the same prompt/validation).
3. If no lead memo: fetch deal record + transcripts + notes directly. Build a data context and call Claude with the same anonymization/formatting rules.
4. Post-process: strip em/en dashes, validate anonymity, generate HTML.
5. Return `{ title, hero_description, description_html, description_markdown, location }`.
6. If `listing_id` provided, also update the listing row.

The prompt enforces:
- Never use em dash or en dash characters. Use hyphens (-) or commas instead.
- Same banned words list as `generate-marketplace-listing`
- Same anonymization rules
- Same section structure (BUSINESS OVERVIEW, DEAL SNAPSHOT, KEY FACTS, GROWTH CONTEXT, OWNER OBJECTIVES) but only include sections with available data

### 4. Files Changed

| File | Change |
|------|--------|
| New: `supabase/functions/generate-listing-content/index.ts` | New edge function that generates all listing fields from deal data |
| `src/components/admin/ImprovedListingEditor.tsx` | Add "AI Generate All Content" button, replace `handleAiGenerate` to use new function |
| `src/components/admin/editor-sections/EditorDescriptionSection.tsx` | Update "Regenerate" to fall back to new function |
| `src/components/admin/editor-sections/EditorHeroDescriptionSection.tsx` | Update "Regenerate" to fall back to new function |
| `supabase/config.toml` | Add `generate-listing-content` function config |

### 5. UI Layout

After publish banner:
```
[  Sparkles  AI Generate All Content  ]   (prominent button, full width)
```

When clicked: button shows spinner + "Generating title, hero, and description from deal data..."

On success: all fields populate, toast: "All listing content generated. Review and edit before publishing."

