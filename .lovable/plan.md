

# Fix Hero/Description Duplication, Garbage Tags, and Content Quality

## Problems Identified

### 1. Hero description = Business Overview (identical)
The `generate-listing-content` edge function (line 434) extracts the hero description directly from the BUSINESS OVERVIEW section of the generated body. So they are literally the same text. The hero should be a separate, shorter elevator pitch that complements (not duplicates) the body.

### 2. Hero description truncated on listing page
`ListingHeader.tsx` line 108 applies `line-clamp-3` which cuts off hero text. Since the hero should be kept short by design, removing the clamp and enforcing a tighter character limit solves this.

### 3. Garbage in `categories` and `services` arrays
The DB shows:
- `categories`: `["Restoration", "Property Damage Restoration; Emergency Services", "fire", "water", "heavily influenced by storm activity"]`
- `services`: Raw prose paragraphs like "The company primarily offers property damage restoration..."

These render as badges on the listing detail page. The `filterCleanServices` function (line 656) allows entries under 60 chars and without certain verbs, but "fire", "water", "heavily influenced by storm activity" all pass those filters.

### 4. Body description quality
The AI-generated body is actually quite good for this deal (DEAL SNAPSHOT, KEY FACTS, OWNER OBJECTIVES). The main issue is the BUSINESS OVERVIEW section being identical to the hero.

## Solution

### File 1: `supabase/functions/generate-listing-content/index.ts`

**Separate hero from body description.** Add a dedicated hero generation step in the AI prompt:

- Add to the system prompt: a `HERO_DESCRIPTION` output that is a standalone 2-sentence elevator pitch (max 280 chars) summarizing what the business is and its financial profile. This must NOT repeat the BUSINESS OVERVIEW verbatim.
- Change the extraction logic (lines 433-447): Instead of copying BUSINESS OVERVIEW into hero, parse a separate `HERO_DESCRIPTION` block from the AI output. If the AI doesn't produce one, generate a distinct summary from deal metrics (revenue, EBITDA, industry, region) that differs from the body overview.
- Reduce hero max length from 500 to 280 characters to ensure it never truncates on the listing page.

### File 2: `src/components/listing-detail/ListingHeader.tsx`

- Line 108: Remove `line-clamp-3` from hero description div. The hero will be short enough by design (280 chars max). Replace with no clamp so it always shows in full.

### File 3: `src/lib/deal-to-listing-anonymizer.ts`

**Fix `filterCleanServices`** (line 656):
- Add minimum length filter: reject entries under 4 characters (catches "fire", "water", etc.)
- Add a blocklist of single common words that are not service names: "fire", "water", "mold", "storm", "wind", "ice", "snow", "rain"
- Reject entries containing semicolons (catches "Property Damage Restoration; Emergency Services" as a single entry)

**Fix `anonymizeDealToListing`** categories building (line 842-849):
- Do NOT merge raw services into categories. Categories should only come from `deal.category` and `deal.industry`. Services are a separate field.

### File 4: Database cleanup for existing listing

Run a migration to fix the specific listing's garbage data:
- Clean `categories` to just `["Restoration"]`
- Clean `services` to just `["Property Damage Restoration", "Emergency Services"]`

### File 5: `src/components/admin/ImprovedListingEditor.tsx`

Update hero description max length from 500 to 280 chars in the Zod schema (line 49).

### File 6: `src/components/admin/editor-sections/EditorHeroDescriptionSection.tsx`

Update `maxChars` from 500 to 280.

## Technical Details

### AI prompt change (edge function)
Add to system prompt output format:
```
HERO_DESCRIPTION (return as a separate block before BUSINESS OVERVIEW):
- 1-2 sentences, max 280 characters
- Financial summary: revenue range, EBITDA/margin, region, industry
- Must NOT repeat the BUSINESS OVERVIEW text
- Think of this as the "card preview" text a buyer sees before clicking
```

### Extraction logic change
```typescript
// Extract HERO_DESCRIPTION block
const heroMatch = markdownText.match(/## HERO_DESCRIPTION\n([\s\S]*?)(?=\n## |$)/);
if (heroMatch) {
  heroDescription = heroMatch[1].replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n+/g, ' ').trim();
  // Remove HERO_DESCRIPTION from the body markdown
  markdownText = markdownText.replace(/## HERO_DESCRIPTION\n[\s\S]*?(?=\n## |$)/, '').trim();
}
// Fallback: build from metrics if AI didn't produce one
if (!heroDescription) {
  // Build from revenue, EBITDA, industry, region
}
```

### Categories fix
The `categories` field should only contain standardized industry/category labels (e.g., "Restoration", "Healthcare", "HVAC"). Never raw service names or enrichment text.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-listing-content/index.ts` | Separate hero generation from body, new extraction logic |
| `src/components/listing-detail/ListingHeader.tsx` | Remove `line-clamp-3` from hero |
| `src/lib/deal-to-listing-anonymizer.ts` | Fix `filterCleanServices`, stop merging services into categories |
| `src/components/admin/ImprovedListingEditor.tsx` | Hero max 280 chars |
| `src/components/admin/editor-sections/EditorHeroDescriptionSection.tsx` | Hero max 280 chars |
| Migration SQL | Clean garbage data on existing listing |

