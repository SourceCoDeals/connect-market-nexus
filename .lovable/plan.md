

# Add Location Column to Match Tool Leads

## What Changes

**Single file**: `src/pages/admin/remarketing/MatchToolLeads/index.tsx`

### 1. Add a Location column to the grid

- Update grid template from `[28px_1fr_1fr_1fr_100px_60px]` to `[28px_1fr_1fr_1fr_120px_100px_60px]` (both header and rows)
- Add "Location" header between Financials and Stage
- Add a location cell in LeadRow

### 2. Extract location from `raw_inputs`

The geo data lives in `raw_inputs` as `city`, `region`, `country`. Display logic:
- US leads: "Portland, OR" (city + state abbreviation)
- International: "Budapest, Hungary" (city + country)
- Fallback: just city, or just region, or empty muted dash

### 3. Move geo out of the Website subtitle

Currently `geo` is shown under the domain name — remove it from there since it gets its own column now.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/remarketing/MatchToolLeads/index.tsx` | Add Location column, extract city/region/country from raw_inputs, remove geo from website subtitle |

