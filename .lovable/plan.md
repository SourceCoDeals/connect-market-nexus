
# Plan: Ensure Business Descriptions Are Platform-Specific

## Status: ✅ IMPLEMENTED

## Solution Implemented

Added a **fallback extraction prompt** that runs when:
- `platform_website` is not available
- `pe_firm_website` content exists

The new `getPlatformFromPEPrompt()` searches the PE firm's portfolio page for the specific `company_name` and extracts:
- `business_summary` - Description of the platform company (NOT the PE firm)
- `services_offered` - What services/products the platform offers
- `industry_vertical` - Industry classification
- `hq_city`, `hq_state`, `geographic_footprint` - Location data
- `platform_website` - URL if found on PE portfolio page (saved for future enrichments)

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/enrich-buyer/index.ts` | Added fallback platform extraction logic + new prompt function |

## Extraction Flow (Updated)

```text
platformWebsite exists?
  → Yes: Scrape platform → Run prompts 1-4 (Business, Customers, Geography, Acquisitions)
  → No: Has pe_firm_website?
      → Yes: Scrape PE → Run NEW fallback prompt (extract platform info by company_name) → Run prompts 4-6
      → No: Error

Both paths then run PE firm prompts (4-6) if PE content available.
```

## Notes

- The fallback only works if the PE firm's website mentions the platform company by name
- Sparse PE website content may return 0 fields (expected behavior)
- Any discovered `platform_website` URL is saved to the database for future use

