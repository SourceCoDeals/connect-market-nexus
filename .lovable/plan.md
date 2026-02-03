
# Fix Location Format: Strict "City, ST" Enforcement

## Problem Statement

**100% of deal locations are in invalid formats.** Current data shows:
- 29 deals: "United States"
- 19 deals: "Southeast US"  
- 9 deals: "Midwest US"
- 5 deals: "Northeast US"
- 4 deals: "Southwest US"
- 4 deals: "Western US"
- Others: "Canada", "Minnesota", "North America", "Global/International"

**None** match the required "City, ST" format (e.g., "Dallas, TX").

### Root Causes

1. **CSV Import**: No validation - accepts any text
2. **Manual Entry**: UI has placeholder "City, State" but no enforcement
3. **Existing Data**: Pre-validation data was never migrated
4. **AI Enrichment**: Validation exists but deals often lack websites to scrape addresses from
5. **Transcript Extraction**: Location extracted but never applied to listings table

---

## Architecture: Location Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOCATION DATA ENTRY POINTS                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CSV Import (DealCSVImport.tsx)                                          │
│     └─► Currently: No validation                                            │
│     └─► FIX: Validate format or clear invalid values                        │
│                                                                             │
│  2. Manual Entry (AddDealToUniverseDialog.tsx)                              │
│     └─► Currently: Placeholder hint only                                    │
│     └─► FIX: Input mask + live validation with error message                │
│                                                                             │
│  3. AI Enrichment (enrich-deal/index.ts)                                    │
│     └─► Currently: Regex validation EXISTS but AI often returns bad format │
│     └─► FIX: Stronger prompt + fallback parsing                             │
│                                                                             │
│  4. Transcript Extraction (extract-deal-transcript/index.ts)                │
│     └─► Currently: Extracts but doesn't apply to listing                    │
│     └─► FIX: Add location to flatExtracted + validate                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Create Shared Location Validation Utility

**File: `src/lib/location-validation.ts`**

Create a client-side utility for consistent location validation:

```typescript
// Regex: "City, ST" where ST is 2-letter state code
const CITY_STATE_PATTERN = /^[A-Za-z\s.\-']+,\s*[A-Z]{2}$/;

// US state codes for validation
const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR' // Include DC and Puerto Rico
]);

// Canadian province codes
const CA_PROVINCE_CODES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
]);

export function isValidCityStateFormat(location: string): boolean {
  if (!location) return false;
  const trimmed = location.trim();
  
  if (!CITY_STATE_PATTERN.test(trimmed)) return false;
  
  // Extract state code and verify it's valid
  const parts = trimmed.split(',');
  if (parts.length !== 2) return false;
  
  const stateCode = parts[1].trim().toUpperCase();
  return US_STATE_CODES.has(stateCode) || CA_PROVINCE_CODES.has(stateCode);
}

export function formatCityState(city: string, state: string): string {
  const cleanCity = city.trim().replace(/\s+/g, ' ');
  const cleanState = state.trim().toUpperCase();
  return `${cleanCity}, ${cleanState}`;
}

export function parseCityState(location: string): { city: string; state: string } | null {
  if (!isValidCityStateFormat(location)) return null;
  const parts = location.split(',');
  return {
    city: parts[0].trim(),
    state: parts[1].trim().toUpperCase()
  };
}
```

**File: `supabase/functions/_shared/location-validation.ts`**

Create the same utility for edge functions (Deno-compatible):

```typescript
// Same validation logic for server-side use
export const CITY_STATE_PATTERN = /^[A-Za-z\s.\-']+,\s*[A-Z]{2}$/;

export function isValidCityStateFormat(location: string): boolean {
  // Same implementation as client
}

export function rejectInvalidLocation(location: unknown): string | null {
  if (!location || typeof location !== 'string') return null;
  const trimmed = location.trim();
  return isValidCityStateFormat(trimmed) ? trimmed : null;
}
```

---

### Phase 2: Enhance AI Enrichment Prompt & Validation

**File: `supabase/functions/enrich-deal/index.ts`**

1. **Strengthen the system prompt** to be more explicit about what's NOT allowed:

```typescript
const systemPrompt = `...
CRITICAL LOCATION RULE - READ CAREFULLY:
The "location" field MUST be in strict "City, ST" format.

REQUIRED FORMAT: "CityName, XX" where XX is a 2-letter US state code or Canadian province code.

EXAMPLES OF VALID LOCATIONS:
- "Dallas, TX"
- "Chicago, IL"  
- "Toronto, ON"
- "San Francisco, CA"

EXAMPLES OF INVALID LOCATIONS (DO NOT USE THESE):
- "United States" ❌
- "Midwest US" ❌
- "Southeast" ❌
- "Texas" ❌
- "California" ❌
- "North America" ❌

HOW TO FIND THE LOCATION:
1. Look in the website footer for a physical address
2. Check the "Contact Us" or "About" page
3. Look for a full address like "123 Main St, Dallas, TX 75201"
4. Extract ONLY the city and 2-letter state code

If you cannot find a specific city and state, leave the location field EMPTY.
Never guess or use a region name.
...`;
```

2. **Add address-to-city-state parsing** as a fallback:

```typescript
// After AI extraction, try to parse address if location is invalid
if (!rejectInvalidLocation(extracted.location) && extracted.address) {
  const parsed = parseAddressToCityState(extracted.address);
  if (parsed) {
    extracted.location = `${parsed.city}, ${parsed.state}`;
  }
}

function parseAddressToCityState(address: string): { city: string; state: string } | null {
  // Pattern: "...City, ST ZIP" or "...City, State ZIP"
  const patterns = [
    /([A-Za-z\s.\-']+),\s*([A-Z]{2})\s*\d{5}/,  // City, ST 12345
    /([A-Za-z\s.\-']+),\s*([A-Z]{2})(?:\s|$)/,   // City, ST (at end)
  ];
  
  for (const pattern of patterns) {
    const match = address.match(pattern);
    if (match) {
      return { city: match[1].trim(), state: match[2] };
    }
  }
  return null;
}
```

---

### Phase 3: Add Validation to Manual Deal Entry

**File: `src/components/remarketing/AddDealToUniverseDialog.tsx`**

Add real-time validation to the location input:

```typescript
// Add validation state
const [locationError, setLocationError] = useState<string | null>(null);

// Validate on change
const handleLocationChange = (value: string) => {
  setNewDealForm(prev => ({ ...prev, location: value }));
  
  if (value && !isValidCityStateFormat(value)) {
    setLocationError('Format must be "City, ST" (e.g., Dallas, TX)');
  } else {
    setLocationError(null);
  }
};

// In JSX:
<div className="space-y-2">
  <Label htmlFor="location">Location</Label>
  <Input
    id="location"
    placeholder="Dallas, TX"
    value={newDealForm.location}
    onChange={(e) => handleLocationChange(e.target.value)}
    className={locationError ? 'border-destructive' : ''}
  />
  {locationError && (
    <p className="text-xs text-destructive">{locationError}</p>
  )}
  <p className="text-xs text-muted-foreground">
    Must be City, ST format (e.g., Chicago, IL)
  </p>
</div>
```

---

### Phase 4: Add Validation to CSV Import

**File: `src/components/remarketing/DealCSVImport.tsx`**

Validate locations during import and either:
- Accept only valid "City, ST" formats
- Clear invalid values (let enrichment fill them later)

```typescript
// In the import mutation, after building listingData:
if (listingData.location && !isValidCityStateFormat(listingData.location)) {
  console.log(`Clearing invalid location "${listingData.location}" - will be enriched from website`);
  delete listingData.location; // Let AI enrichment fill this
}
```

---

### Phase 5: Fix Transcript Extraction to Apply Location

**File: `supabase/functions/extract-deal-transcript/index.ts`**

Add location to the fields that get applied to the listing (with validation):

```typescript
// After line 423, add:
if (extracted.location) {
  const validLocation = rejectInvalidLocation(extracted.location);
  if (validLocation) {
    flatExtracted.location = validLocation;
  }
}
if (extracted.headquarters_address) {
  flatExtracted.address = extracted.headquarters_address;
}
```

---

### Phase 6: Data Migration - Clear Invalid Locations

**One-time SQL migration** to clear all invalid location data:

```sql
-- Clear invalid locations so enrichment can repopulate them
UPDATE listings
SET location = NULL
WHERE location IS NOT NULL
  AND location !~ '^[A-Za-z\s.\-'']+,\s*[A-Z]{2}$';

-- Verify
SELECT location, COUNT(*) 
FROM listings 
WHERE location IS NOT NULL
GROUP BY location;
```

This allows re-enrichment to populate correct "City, ST" values from website scraping.

---

## Technical Summary

| File | Change |
|------|--------|
| **CREATE** `src/lib/location-validation.ts` | Client-side validation utilities |
| **CREATE** `supabase/functions/_shared/location-validation.ts` | Server-side validation utilities |
| **MODIFY** `supabase/functions/enrich-deal/index.ts` | Stronger prompt, address parsing fallback |
| **MODIFY** `src/components/remarketing/AddDealToUniverseDialog.tsx` | Input validation with error message |
| **MODIFY** `src/components/remarketing/DealCSVImport.tsx` | Clear invalid locations on import |
| **MODIFY** `supabase/functions/extract-deal-transcript/index.ts` | Apply validated location to listings |
| **SQL** | One-time migration to clear invalid location data |

---

## Validation Test Cases

After implementation, verify:

1. **Manual Entry**: Cannot submit "Texas" or "Southeast US" - shows error
2. **CSV Import**: Invalid locations are cleared, deal still imports
3. **AI Enrichment**: Scrapes address from website footer, extracts "City, ST"
4. **Transcript**: Valid "City, ST" from transcript gets applied to listing
5. **Data Migration**: Query confirms no invalid formats remain

---

## Success Criteria

- 0 deals with location = "United States", "Southeast US", "Midwest US", etc.
- All locations match pattern `^[A-Za-z\s.\-']+,\s*[A-Z]{2}$`
- New deals cannot be created with invalid locations
- AI enrichment reliably extracts city/state from website addresses
