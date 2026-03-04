

# Simplify Auto Calculator Leads — Single "Auto" Tab

## Current State
The edge function maps `service_type` → separate `calculator_type` values (`collision`, `mechanical`, `specialty`, `auto_shop`), creating multiple tabs. The user wants **one tab for all auto calculator leads** — classification can happen later.

## Plan

### 1. Edge function: map all auto types → `auto_shop`
In `receive-valuation-lead/index.ts` line 141-144, change:
```ts
// Before: splits into collision/mechanical/specialty
const calculatorType = serviceType === "collision" ? "collision" : ...

// After: everything from this calculator = "auto_shop"
const calculatorType = "auto_shop";
```
The raw `service_type` is already preserved in `raw_calculator_inputs`, so no data is lost.

### 2. Migration: normalize existing leads
Update any existing `collision`, `mechanical`, or `specialty` rows to `auto_shop`:
```sql
UPDATE valuation_leads 
SET calculator_type = 'auto_shop' 
WHERE calculator_type IN ('collision', 'mechanical', 'specialty');
```

### 3. UI: simplify tabs
In `useValuationLeadsQueries.ts` line 168-177, the `calculatorTypes` memo dynamically builds tabs from data. After the migration, only `auto_shop` and `general` will exist — the extra tabs disappear automatically. No code change needed.

### 4. Upload dialog mapping
In `ValuationLeadUploadDialog.tsx` line 172-178, update `SERVICE_TYPE_TO_CALCULATOR` to map everything to `auto_shop`.

### Files to change

| File | Change |
|------|--------|
| `receive-valuation-lead/index.ts` | Set `calculatorType = "auto_shop"` (remove conditional mapping) |
| Migration SQL | Normalize existing collision/mechanical/specialty → auto_shop |
| `ValuationLeadUploadDialog.tsx` | Map all service types → auto_shop |
| Redeploy edge function | Auto after file edit |

