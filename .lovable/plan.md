
# Plan: Ensure Business Descriptions Are Platform-Specific

## Problem Analysis

After investigating the enrichment pipeline, I found the following behavior:

### Current Behavior
| Scenario | Business Summary Source | Result |
|----------|-------------------------|--------|
| `platform_website` exists | Platform company website | ✅ Correct |
| Only `pe_firm_website` | No extraction attempted | ⚠️ No data |
| Neither website | Error returned | N/A |

The enrichment pipeline correctly extracts the platform company description when a `platform_website` is provided. When only the PE firm website exists, the `business_summary` is never populated because:
- Prompts 1-4 (Business Overview, Customers, Geography, Acquisitions) only run when `platformContent` exists
- Prompts 5-6 (PE Thesis, Deal Structure, Portfolio) run on PE firm content but don't extract `business_summary`

### Data Check
Looking at your current buyer universe:
- **With platform_website**: "Insure Homes Holdings" → correctly shows Cypress Property & Casualty description
- **Without platform_website**: "Disaster Restoration Contractor", "Trades Holding Company" → no business summary

## Proposed Solution

### Option A: Smart Platform Discovery (Recommended)
When only `pe_firm_website` is available, search for the platform company on the PE firm's portfolio page using the buyer's `company_name`, then scrape that platform website.

### Option B: PE Portfolio Company Extraction
Enhance the PE website extraction to identify and extract details about the specific platform company from the portfolio page content.

## Implementation Details

### 1. Add Platform Discovery from PE Portfolio

Modify `enrich-buyer/index.ts`:

```text
+------------------------------------------+
|  When only pe_firm_website exists:       |
|                                          |
|  1. Scrape PE firm website               |
|  2. Search for platform by company_name  |
|  3. Extract platform_website URL         |
|  4. If found: scrape platform website    |
|  5. Run business overview on platform    |
+------------------------------------------+
```

### 2. New AI Prompt: Platform Website Discovery

Add a new prompt function that:
- Takes PE firm portfolio page content
- Searches for the buyer's `company_name` 
- Extracts the platform company's website URL
- Returns the URL for subsequent scraping

### 3. Update Extraction Flow

```text
Current Flow:
  platformWebsite exists? 
    → Yes: Scrape platform → Extract business info
    → No: Skip business prompts
    
New Flow:
  platformWebsite exists?
    → Yes: Scrape platform → Extract business info
    → No: Has pe_firm_website?
        → Yes: Scrape PE → Discover platform URL → Scrape platform → Extract
        → No: Error
```

### 4. Fallback: PE-Context Business Summary

If platform URL cannot be discovered from PE portfolio, create a PE-aware business prompt that:
- Searches the PE firm's portfolio description for the specific company
- Extracts only information about that specific platform
- Clearly labels the extraction source

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/enrich-buyer/index.ts` | Add platform discovery prompt and logic |

## Technical Approach

1. Add new `discoverPlatformFromPortfolio()` prompt function
2. Insert discovery step after PE firm scraping when `platformContent` is null
3. If platform URL found, scrape and run business overview prompts
4. Add `platform_website` to database update when discovered
5. Track discovery source in `extraction_sources`

## Expected Outcome

After enrichment:
- Buyers with `platform_website` → business summary from platform (unchanged)
- Buyers with only `pe_firm_website` → system discovers platform URL from PE portfolio → business summary from platform
- Platform URLs discovered during enrichment are saved for future use

## Considerations

- **Rate Limits**: Adds 1-2 extra API calls per buyer when platform discovery is needed
- **Accuracy**: Platform may not always be findable in PE portfolio pages
- **Data Persistence**: Discovered `platform_website` should be saved to avoid re-discovery
