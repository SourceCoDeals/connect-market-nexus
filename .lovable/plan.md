
# Plan: LinkedIn Employee Data via Apify + UI Display + Build Error Fixes

## Problem Summary

1. **Employees column not showing data**: The UI displays `full_time_employees` but doesn't include `linkedin_employee_count` which already exists in the database
2. **No LinkedIn scraping capability**: Apify is not integrated to automatically scrape LinkedIn company pages for employee count/range
3. **Build errors**: Multiple TypeScript errors in edge functions need fixing before any deployment

---

## Solution Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEAL ENRICHMENT FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Deal Added → Auto-Enrich Triggered                                       │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐      │
│  │  enrich-deal    │ --> │ NEW: apify-      │ --> │  listings table  │      │
│  │  (Firecrawl +   │     │ linkedin-scrape  │     │                  │      │
│  │   Gemini)       │     │                  │     │ linkedin_employee│      │
│  └─────────────────┘     └──────────────────┘     │ _count           │      │
│                                                    │ linkedin_employee│      │
│                                                    │ _range (NEW)     │      │
│                                                    └──────────────────┘      │
│                                                             │                │
│                                                             ▼                │
│                                                    ┌──────────────────┐      │
│                                                    │  All Deals Table │      │
│                                                    │  Shows: count +  │      │
│                                                    │  range combined  │      │
│                                                    └──────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Fix Build Errors (Required First)

Fix TypeScript errors in 6 edge functions:

| File | Error | Fix |
|------|-------|-----|
| `analyze-deal-notes/index.ts` | `geographic_states` missing from interface | Add `geographic_states?: string[]` to the extracted interface |
| `enrich-deal/index.ts` | `geographic_states` on finalUpdates | Add to interface |
| `enrich-buyer/index.ts` | `billingError` typed as `never` | Type as `{ code?: string; message?: string }` |
| `enrich-geo-data/index.ts` | `error` is `unknown` | Cast with `error instanceof Error ? error.message : 'Unknown error'` |
| `enrich-session-metadata/index.ts` | `error` is `unknown` | Same fix |
| `extract-deal-transcript/index.ts` | `error` is `unknown` | Same fix |
| `generate-ma-guide/index.ts` | Multiple `error` unknown | Same fix |
| `import-reference-data/index.ts` | Multiple `e` unknown | Same fix |
| `generate-buyer-intro/index.ts` | `error` unknown | Same fix |

### Phase 2: Add Database Column

Add `linkedin_employee_range` column to `listings` table:
- Type: `text` (stores ranges like "51-200", "201-500")
- This complements the existing `linkedin_employee_count` numeric field

### Phase 3: Create Apify LinkedIn Scraper Edge Function

New file: `supabase/functions/apify-linkedin-scrape/index.ts`

This function will:
1. Accept a company name or website URL
2. Search LinkedIn for the company page (or use a provided LinkedIn URL)
3. Call Apify's LinkedIn Company Scraper actor
4. Extract employee count and employee range
5. Return structured data for the enrichment pipeline

```typescript
// Key API call structure
const response = await fetch(
  `https://api.apify.com/v2/acts/logical_scrapers~linkedin-company-scraper/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: [linkedInCompanyUrl] })
  }
);
```

Expected response includes:
- `employeeCount`: Number (e.g., 150)
- `employeeCountRange`: String (e.g., "51-200")

### Phase 4: Integrate into Enrichment Pipeline

Modify `supabase/functions/enrich-deal/index.ts`:

1. After Firecrawl scraping, check if AI extracted a LinkedIn company URL
2. If found (or if `linkedin_url` exists on the deal), call the new Apify function
3. Update `linkedin_employee_count` and `linkedin_employee_range` fields
4. This runs automatically during auto-enrichment on deal creation

### Phase 5: Update UI to Display LinkedIn Data

Modify `src/pages/admin/remarketing/ReMarketingDeals.tsx`:

1. **Update interface**: Add `linkedin_employee_count` and `linkedin_employee_range`
2. **Update query**: Fetch both fields from Supabase
3. **Update display logic**: Show LinkedIn data with fallback to `full_time_employees`:

```typescript
// In SortableTableRow
{listing.linkedin_employee_count || listing.linkedin_employee_range ? (
  <div className="text-sm">
    <span>{listing.linkedin_employee_count?.toLocaleString() || listing.linkedin_employee_range}</span>
    <span className="text-xs text-blue-500 ml-1">LI</span>
  </div>
) : listing.full_time_employees ? (
  <span className="text-sm">{listing.full_time_employees}</span>
) : (
  <span className="text-muted-foreground">—</span>
)}
```

### Phase 6: Add Apify API Key Configuration

1. Add APIFY_API_TOKEN as a secret (you'll need to provide this)
2. The edge function will read it via `Deno.env.get('APIFY_API_TOKEN')`

---

## Technical Details

### Apify API Call (Synchronous Pattern)

```typescript
// Use run-sync-get-dataset-items for immediate results
const APIFY_ACTOR = 'logical_scrapers~linkedin-company-scraper';
const url = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;

const response = await fetch(`${url}?token=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: [linkedInCompanyUrl]
  }),
  signal: AbortSignal.timeout(60000) // 60s timeout for LinkedIn scrape
});

const items = await response.json();
// items[0] contains company data including employeeCount, employeeCountRange
```

### Data Flow on Deal Creation

1. User imports deal via CSV or creates manually
2. `ReMarketingDeals.tsx` auto-enrichment effect triggers
3. Calls `enrich-deal` edge function
4. `enrich-deal` scrapes website, extracts data with AI
5. If LinkedIn URL found, chains call to `apify-linkedin-scrape`
6. Updates `listings` table with all enriched fields
7. UI refreshes via React Query invalidation

### Rate Limiting Considerations

- Apify has usage-based pricing
- Implement skip logic if `linkedin_employee_count` already populated
- Batch processing with delays to avoid hitting rate limits

---

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| CREATE | `supabase/functions/apify-linkedin-scrape/index.ts` | New Apify LinkedIn scraper |
| MODIFY | `supabase/functions/analyze-deal-notes/index.ts` | Fix TypeScript errors |
| MODIFY | `supabase/functions/enrich-deal/index.ts` | Fix errors + integrate LinkedIn |
| MODIFY | `supabase/functions/enrich-buyer/index.ts` | Fix TypeScript errors |
| MODIFY | `supabase/functions/enrich-geo-data/index.ts` | Fix TypeScript errors |
| MODIFY | `supabase/functions/enrich-session-metadata/index.ts` | Fix TypeScript errors |
| MODIFY | `supabase/functions/extract-deal-transcript/index.ts` | Fix TypeScript errors |
| MODIFY | `supabase/functions/generate-ma-guide/index.ts` | Fix TypeScript errors |
| MODIFY | `supabase/functions/import-reference-data/index.ts` | Fix TypeScript errors |
| MODIFY | `supabase/functions/generate-buyer-intro/index.ts` | Fix TypeScript errors |
| MODIFY | `src/pages/admin/remarketing/ReMarketingDeals.tsx` | Display LinkedIn data |
| SQL | Add `linkedin_employee_range` column to `listings` | Database schema change |

---

## Prerequisites

Before implementation:
1. **Apify API Token**: You'll need to provide an Apify API key
2. **LinkedIn Company URLs**: Deals should have LinkedIn company URLs (can be extracted from websites or added manually)

---

## Summary

This plan adds LinkedIn employee data scraping via Apify, displays both LinkedIn and manual employee counts in the All Deals table, and fixes all the TypeScript build errors that are currently blocking deployment. The LinkedIn data will be fetched automatically during deal enrichment when a company LinkedIn URL is available.
