

# Fix Build Errors + Edge Function Calculator Type Mapping

## Verification Result

Your submission **was received successfully**. Both `incoming_leads` and `valuation_leads` were updated for `ahaile14@gmail.com`. The edge function is working end-to-end.

**However, two data issues were found:**
1. `calculator_type` mapped to `auto_shop` instead of `specialty` — the mapping logic only handles `collision` and `mechanical`, everything else falls through to `auto_shop`
2. `buyer_lane` still shows old value — the `.lane` → `.title` fix may not have deployed yet, or the value `"Local Strategic Buyers"` (full title) is being stored instead of the short code

## Changes

### 1. Fix calculator_type mapping (edge function)
In `supabase/functions/receive-valuation-lead/index.ts` line 149-151, add `specialty` to the mapping:

```typescript
const calculatorType = serviceType === "collision" ? "collision"
  : serviceType === "mechanical" ? "mechanical"
  : serviceType === "specialty" ? "specialty"
  : serviceType ?? "auto_shop";
```

Also update the VALUATION_LEAD_FIELDS filter options to include `specialty`:
```typescript
{ label: 'Specialty', value: 'specialty' },
```

### 2. Fix 5 build errors (TypeScript)

**BuyerRelationshipSection.tsx:**
- Remove unused `AlertTriangle` import (line 17)
- Fix `isPeBacked={co.is_pe_backed}` → `isPeBacked={co.is_pe_backed ?? false}` (line 186)

**RecommendedBuyersPanel.tsx:**
- Add missing `is_pe_backed` to score_snapshot object (line 384): `is_pe_backed: buyer.is_pe_backed ?? false,`

**SignupStepAccount.tsx:**
- Remove unused `checking` variable (line 15)

**BuyerClassificationTest.tsx:**
- Remove unused `Search` import (line 34)

**PEFirmLinkReview.tsx:**
- Remove unused `CardHeader`, `CardTitle` imports (line 4)
- Remove unused `AlertCircle` import (line 18)
- Change `backfill_status` to a valid column or cast via `.update({} as any)` (line 154) — need to check if column exists

### 3. Redeploy edge function
Deploy `receive-valuation-lead` after the fix to ensure the `specialty` type and `.title` fix are live.

