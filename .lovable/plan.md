
# Fix: PE Firm & Business Data Not Populating During Enrichment

## Root Cause

The edge function logs reveal the exact issue:
```
Failed to update buyer: {
  code: "PGRST204",
  message: "Could not find the 'services_offered' column of 'remarketing_buyers' in the schema cache"
}
```

The AI extraction is **working correctly** - it successfully extracts 15-18 fields including `pe_firm_name`, `thesis_summary`, and `business_summary`. However, the database update **fails entirely** because the edge function tries to save fields that don't exist in the database schema.

When PostgREST encounters a non-existent column, it rejects the **entire update** - losing all extracted data, including valid fields.

### Fields Being Extracted That Don't Exist:
| Field | Extracted In | Exists in DB |
|-------|-------------|--------------|
| `services_offered` | Prompt 1 (Business Overview) | No |
| `business_type` | Prompt 1 | No |
| `revenue_model` | Prompt 1 | No |

### Fields That ARE Being Extracted Correctly But Lost:
- `pe_firm_name` - exists in DB
- `business_summary` - exists in DB  
- `thesis_summary` - exists in DB
- `thesis_confidence` - exists in DB
- `strategic_priorities` - exists in DB
- etc.

---

## Solution

Two options to fix this:

### Option A: Add Missing Columns to Database (Recommended)
Add the three missing columns that provide valuable business intelligence:

```sql
ALTER TABLE public.remarketing_buyers 
  ADD COLUMN IF NOT EXISTS services_offered TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS revenue_model TEXT;
```

### Option B: Filter Out Invalid Fields in Edge Function
Modify `buildUpdateObject()` to only include fields that exist in the schema:

```typescript
const VALID_BUYER_COLUMNS = new Set([
  'thesis_summary', 'thesis_confidence', 'pe_firm_name', 'business_summary',
  'hq_city', 'hq_state', 'geographic_footprint', 'service_regions',
  // ... all valid columns
]);

for (const field of Object.keys(extractedData)) {
  if (!VALID_BUYER_COLUMNS.has(field)) {
    console.warn(`Skipping non-existent column: ${field}`);
    continue;
  }
  // ... rest of merge logic
}
```

---

## Recommended Approach: Option A + Safety Net

1. **Add the missing columns** - `services_offered`, `business_type`, `revenue_model` are valuable business intelligence that should be stored

2. **Add a schema validation safety net** - Filter out any fields that don't match the known schema to prevent future issues

---

## Implementation Plan

### Step 1: Database Migration
Create a migration to add the missing columns:

```sql
-- Add missing enrichment columns to remarketing_buyers
ALTER TABLE public.remarketing_buyers 
  ADD COLUMN IF NOT EXISTS services_offered TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS revenue_model TEXT;

-- Add helpful comments
COMMENT ON COLUMN public.remarketing_buyers.services_offered IS 'Primary services or products offered by the company';
COMMENT ON COLUMN public.remarketing_buyers.business_type IS 'Type of business (Service Provider, Manufacturer, etc.)';
COMMENT ON COLUMN public.remarketing_buyers.revenue_model IS 'How the company generates revenue';
```

### Step 2: Add Schema Validation Safety Net
Update `supabase/functions/enrich-buyer/index.ts` to validate fields before updating:

Add a constant listing all valid columns:
```typescript
const VALID_BUYER_COLUMNS = new Set([
  // Core fields
  'thesis_summary', 'thesis_confidence', 'pe_firm_name', 'business_summary',
  'hq_city', 'hq_state', 'hq_country', 'hq_region',
  'geographic_footprint', 'service_regions', 'operating_locations',
  // Customer/Market fields
  'primary_customer_size', 'customer_geographic_reach', 'customer_industries', 'target_customer_profile',
  // Investment fields
  'target_revenue_min', 'target_revenue_max', 'revenue_sweet_spot',
  'target_ebitda_min', 'target_ebitda_max', 'ebitda_sweet_spot',
  'target_services', 'target_industries', 'target_geographies',
  // Deal fields
  'deal_preferences', 'deal_breakers', 'acquisition_timeline', 'acquisition_appetite', 'acquisition_frequency',
  // Acquisition history
  'recent_acquisitions', 'portfolio_companies', 'total_acquisitions', 'num_platforms',
  // Metadata
  'strategic_priorities', 'specialized_focus', 'industry_vertical',
  'data_completeness', 'data_last_updated', 'extraction_sources',
  // New columns
  'services_offered', 'business_type', 'revenue_model',
]);
```

Update `buildUpdateObject()` to filter invalid fields:
```typescript
function buildUpdateObject(...): Record<string, any> {
  // ... existing code ...

  for (const field of Object.keys(extractedData)) {
    // Safety: Skip fields that don't exist in schema
    if (!VALID_BUYER_COLUMNS.has(field)) {
      console.warn(`Skipping non-existent column: ${field}`);
      continue;
    }
    
    // ... rest of existing merge logic ...
  }
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/[new].sql` | Add `services_offered`, `business_type`, `revenue_model` columns |
| `supabase/functions/enrich-buyer/index.ts` | Add `VALID_BUYER_COLUMNS` schema validation |

---

## Expected Outcome

After this fix:
1. All extracted fields will be saved to the database successfully
2. PE firm name, business description, thesis summary will populate correctly
3. Future schema mismatches will be logged but won't break the entire update
4. New columns will store valuable services/business type intelligence

---

## Technical Details

### Why This Happened
The AI prompts were updated to extract additional fields (`services_offered`, `business_type`, `revenue_model`) but the corresponding database columns were never created. PostgREST's strict schema validation rejects updates containing unknown columns.

### Why It Wasn't Caught Earlier
The edge function was returning 500 errors with "Failed to save enrichment data", but the detailed error message (including the specific missing column) was only visible in the logs.
