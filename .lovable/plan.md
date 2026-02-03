
# Plan: Ensure Business Descriptions Are Platform-Specific

## Status: ✅ NO CHANGES NEEDED

## Analysis

The enrichment pipeline already correctly extracts business descriptions from `platform_website` when it's populated:

| Scenario | Result |
|----------|--------|
| `platform_website` exists | ✅ Business summary extracted from platform |
| Only `pe_firm_website` | ⚠️ No business summary (expected - no platform to scrape) |

## Key Finding

The issue is **data population**, not code logic. Buyers missing `business_summary` are those without a `platform_website` URL populated. The solution is to ensure all buyers have their `platform_website` field filled in during import/data entry.

## Current Flow (Working as Designed)

```text
1. Scrape platform_website (or company_website as fallback)
2. Run AI prompts 1-4 on platform content → business_summary, services, geography, acquisitions
3. Scrape pe_firm_website (if different)
4. Run AI prompts 4-6 on PE content → thesis, deal structure, portfolio info
```

The `business_summary` is intentionally extracted from the platform company website, not the PE firm website.


