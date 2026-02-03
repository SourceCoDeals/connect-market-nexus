

# Structured Address System for Remarketing Intelligence

## Problem Statement

The current system has a fundamental architecture conflict:
- **Marketplace (public)**: Intentionally uses anonymous region-based locations ("Southeast US", "Midwest US") for deal privacy
- **Remarketing (internal)**: Needs accurate address data for buyer matching, geography scoring, and outreach

Currently, there's only a single `address` TEXT column and a `location` TEXT column. The enrichment function tries to enforce "City, ST" format on `location`, but this conflicts with the marketplace's need for anonymous regions.

## Solution Architecture

**Keep `location` as-is for marketplace** (anonymous regions like "Southeast US")  
**Add new structured address columns** for internal remarketing use:
- `street_address` - Street number and name
- `address_city` - City name
- `address_state` - 2-letter state code
- `address_zip` - ZIP/postal code  
- `address_country` - Country (defaults to "US")

The remarketing UI will display `address_city, address_state` as the "Headquarters" instead of `location`, while marketplace continues showing the anonymous `location` field.

---

## Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ADDRESS DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   MARKETPLACE (Public View)          REMARKETING (Internal View)            │
│   ─────────────────────────          ──────────────────────────             │
│                                                                              │
│   Shows: location column             Shows: address_city + address_state    │
│   Example: "Southeast US"            Example: "Dallas, TX"                  │
│                                                                              │
│   ✓ Anonymous for privacy            ✓ Accurate for matching                │
│   ✓ Region-based                     ✓ City/State granularity              │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Website Scraper (enrich-deal)                                              │
│         │                                                                    │
│         ├──► Scrapes address from website footer/contact page               │
│         │                                                                    │
│         ├──► Parses into components:                                        │
│         │    • street_address: "123 Main Street"                            │
│         │    • address_city: "Dallas"                                        │
│         │    • address_state: "TX"                                           │
│         │    • address_zip: "75201"                                          │
│         │    • address_country: "US"                                         │
│         │                                                                    │
│         └──► DOES NOT modify 'location' column (keeps marketplace value)   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Database Schema Migration

**File: `supabase/migrations/[timestamp]_structured_address_columns.sql`**

Add new columns to the `listings` table:

```sql
-- Add structured address columns for remarketing accuracy
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS address_zip TEXT,
  ADD COLUMN IF NOT EXISTS address_country TEXT DEFAULT 'US';

-- Add index for geographic queries
CREATE INDEX IF NOT EXISTS idx_listings_address_state ON listings(address_state);

-- Migrate existing address data where parseable
UPDATE listings
SET 
  address_city = TRIM(SPLIT_PART(address, ',', 1)),
  address_state = UPPER(TRIM(REGEXP_REPLACE(SPLIT_PART(address, ',', 2), '\s*\d{5}.*', '')))
WHERE address IS NOT NULL
  AND address ~ '^[^,]+,\s*[A-Za-z]{2}';
```

### Phase 2: Update enrich-deal Edge Function

**File: `supabase/functions/enrich-deal/index.ts`**

Modify the AI extraction schema to return structured address components:

1. **Update AI prompt** to extract address as components:
   - `street_address`: Street number and name only
   - `address_city`: City name
   - `address_state`: 2-letter state code
   - `address_zip`: ZIP code
   - `address_country`: Country (default "US")

2. **Update tool schema** with new fields:
```typescript
street_address: {
  type: 'string',
  description: 'Street address only (e.g., "123 Main Street")'
},
address_city: {
  type: 'string',
  description: 'City name only (e.g., "Dallas")'
},
address_state: {
  type: 'string',
  description: '2-letter US state code (e.g., "TX")'
},
address_zip: {
  type: 'string',
  description: '5-digit ZIP code (e.g., "75201")'
},
address_country: {
  type: 'string',
  description: 'Country code (default: "US")'
}
```

3. **Add validation** for each component:
   - `address_state`: Must be valid 2-letter code
   - `address_zip`: Must be 5 digits (US) or valid postal format
   - Reject invalid values, don't write nulls

4. **Remove `location` from enrichment updates** - never overwrite the marketplace's anonymous location

5. **Update VALID_LISTING_UPDATE_KEYS**:
```typescript
// Remove 'location' - keep marketplace value untouched
// Add new structured fields
'street_address',
'address_city', 
'address_state',
'address_zip',
'address_country',
```

### Phase 3: Update Remarketing UI Components

**File: `src/components/remarketing/deal-detail/CompanyOverviewCard.tsx`**

Update the card to display structured address:

1. **Add new props**:
```typescript
interface CompanyOverviewCardProps {
  // ... existing props
  streetAddress: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  addressCountry: string | null;
}
```

2. **Update HEADQUARTERS display** to show `addressCity, addressState` instead of `location`

3. **Update ADDRESS display** to show full structured address:
```
123 Main Street
Dallas, TX 75201
```

4. **Update Edit Dialog** with structured address fields:
   - Street Address input
   - City input
   - State dropdown (2-letter codes)
   - ZIP input
   - Country dropdown

### Phase 4: Update Remarketing Deal Detail Page

**File: `src/pages/admin/remarketing/ReMarketingDealDetail.tsx`**

1. **Pass new props** to CompanyOverviewCard:
```typescript
<CompanyOverviewCard
  streetAddress={deal.street_address}
  addressCity={deal.address_city}
  addressState={deal.address_state}
  addressZip={deal.address_zip}
  addressCountry={deal.address_country}
  // Keep location for reference but don't display as HQ
  marketplaceLocation={deal.location}
/>
```

2. **Update header location display**:
   - Show `address_city, address_state` instead of `location`
   - Only if structured address exists, otherwise show "Location TBD"

3. **Update onSave handler** to save structured address fields

### Phase 5: Update Remarketing Deals Table

**File: `src/pages/admin/remarketing/ReMarketingDeals.tsx`**

1. **Update geography display logic** to prefer structured address:
```typescript
const geographyDisplay = deal.address_city && deal.address_state
  ? `${deal.address_city}, ${deal.address_state}`
  : deal.geographic_states?.length 
    ? deal.geographic_states.join(', ')
    : null;
```

2. **Update search** to include new address fields

### Phase 6: Update CSV Import

**File: `src/components/remarketing/DealCSVImport.tsx`**

1. **Add column mappings** for structured address:
   - `street_address` / `street` / `address_line_1`
   - `city` / `address_city`
   - `state` / `address_state` 
   - `zip` / `zip_code` / `postal_code`
   - `country` / `address_country`

2. **Validate state codes** during import

3. **Do NOT touch `location` column** - let marketplace handle it

---

## Technical Summary

| File | Changes |
|------|---------|
| **CREATE** `supabase/migrations/[timestamp]_structured_address_columns.sql` | Add 5 new address columns |
| **MODIFY** `supabase/functions/enrich-deal/index.ts` | Extract structured address, remove location updates |
| **MODIFY** `src/components/remarketing/deal-detail/CompanyOverviewCard.tsx` | Display & edit structured address |
| **MODIFY** `src/pages/admin/remarketing/ReMarketingDealDetail.tsx` | Pass new props, update header |
| **MODIFY** `src/pages/admin/remarketing/ReMarketingDeals.tsx` | Display city/state in table |
| **MODIFY** `src/components/remarketing/DealCSVImport.tsx` | Map structured address columns |
| **MODIFY** `src/components/remarketing/AddDealToUniverseDialog.tsx` | Structured address inputs |

---

## Key Benefits

1. **Privacy Preserved**: Marketplace continues showing anonymous regions
2. **Accuracy for Matching**: Remarketing has exact city/state for buyer geography scoring
3. **Data Quality**: Structured fields enable validation (valid state codes, ZIP format)
4. **No Data Loss**: Existing `address` and `location` columns remain unchanged
5. **Future Proof**: Structured data enables distance calculations, maps, etc.

---

## Validation Rules

| Field | Validation |
|-------|------------|
| `address_state` | Must be valid 2-letter US/CA code from known set |
| `address_zip` | 5 digits for US, alphanumeric for CA |
| `address_city` | Non-empty string, letters/spaces/hyphens only |
| `address_country` | "US" or "CA" (expandable later) |

---

## Data Migration Strategy

1. **Existing `address` data**: Parse where possible (City, ST format → split)
2. **Existing `location` data**: Leave untouched (marketplace needs it)
3. **Re-enrichment**: Running enrichment on deals with websites will populate new fields

