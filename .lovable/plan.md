
# Fix: Listing Detail Page Crash Due to `key_risks` Type Mismatch

## Root Cause

The listing `4524ff91-e5a2-497d-8f7d-7e65b9e991d4` has `key_risks` stored as a **JSONB string** instead of a **JSONB array**:

```
"Profitability is currently impacted..."  // ❌ String
["Profitability is currently impacted..."] // ✅ Array
```

The `EnhancedInvestorDashboard` component calls `.map()` on `key_risks`, which fails on strings.

## Recommended Fix (Two-Part Solution)

### Part 1: Defensive Code Fix (Immediate)

Update `EnhancedInvestorDashboard.tsx` to safely handle both string and array formats:

```typescript
// Normalize key_risks to always be an array
const normalizeToArray = (value: string[] | string | undefined | null): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
};

const keyRisks = normalizeToArray(listing.key_risks);
const growthDrivers = normalizeToArray(listing.growth_drivers);
```

Then use `keyRisks` and `growthDrivers` in the render:

```tsx
{keyRisks.length > 0 && (
  <div className="space-y-2">
    {keyRisks.map((risk, index) => (
      <div key={index}>• {risk}</div>
    ))}
  </div>
)}
```

### Part 2: Data Cleanup (Optional but Recommended)

Run a migration to fix the malformed data:

```sql
UPDATE listings
SET key_risks = to_jsonb(ARRAY[key_risks #>> '{}'])
WHERE jsonb_typeof(key_risks) = 'string'
  AND key_risks IS NOT NULL;
```

This converts any string values into single-element arrays.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/listing-detail/EnhancedInvestorDashboard.tsx` | Add `normalizeToArray` helper and use it for `key_risks` and `growth_drivers` |

## Technical Details

The defensive code approach is preferred because:
1. It prevents crashes immediately without database changes
2. It handles future data inconsistencies gracefully
3. It's backward compatible with both formats
4. The data cleanup can be done later as a non-urgent task

## Expected Result

After the fix:
- The listing page at `/listing/4524ff91-e5a2-497d-8f7d-7e65b9e991d4` will render correctly
- The risk text will display as a single bullet point (since it's one string)
- All other listings will continue to work as expected
