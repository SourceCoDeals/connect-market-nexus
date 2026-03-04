

# Clean Up Valuation Leads — Data + Architecture Fix

## Problems Found

1. **Tab counts are wrong**: Line 275 counts from raw `leads` (all non-excluded), but the table filters out `is_archived` leads. Both collision leads are archived → tab shows "2" but table shows 0.
2. **Test/junk data**: `unique-xyz-test-789@example.com` (collision test), `bill.martin@sourcecodeals.com` (internal test archived), `adambhaile00@gmail.com` and `ahaile14@gmail.com` (your own test leads, archived).
3. **`not_a_fit` column doesn't exist** in the database but code references it in 5 files — this causes silent failures on updates and the "Not Fit Hidden" toggle does nothing.
4. **`needs_buyer_search`, `needs_buyer_universe`, `need_to_contact_owner`, `needs_owner_contact`** — also referenced in `types.ts` but don't exist as columns.

## Plan

### 1. Delete test/junk leads (data cleanup)
Delete these rows from `valuation_leads`:
- `636b29f2-...` — test@example.com collision test
- `39dbbbcb-...` — bill.martin internal test (archived)
- `4aac59dd-...` — adambhaile00 test (archived)
- `a7e4b375-...` — ahaile14 test (archived)

### 2. Add missing `not_a_fit` column (migration)
```sql
ALTER TABLE valuation_leads ADD COLUMN IF NOT EXISTS not_a_fit boolean DEFAULT false;
```
This makes the existing UI code (toggles, badges, row styling, mutations) actually work.

### 3. Fix tab counts to match displayed data
In `index.tsx` line 275, change the count from raw `leads` to use `filteredLeads`-compatible logic (exclude archived, respect hideNotFit):
```tsx
// Before: counts all non-excluded leads
({(leads || []).filter((l) => l.calculator_type === type).length})

// After: counts leads that would actually show in the table
({(leads || []).filter((l) => l.calculator_type === type && !l.is_archived).length})
```

### 4. Clean up `types.ts` phantom fields
Remove `needs_buyer_search`, `needs_buyer_universe`, `need_to_contact_owner`, `needs_owner_contact` from the type definition — they don't exist and aren't used in any UI logic.

### 5. Capitalize tab labels properly
The screenshot shows lowercase "collision" — add proper capitalization for all dynamic types.

### Files to change

| File | Change |
|------|--------|
| Migration SQL | Add `not_a_fit` column |
| Data cleanup (insert tool) | Delete 4 test/junk rows |
| `index.tsx` ~line 275 | Fix tab counts to exclude archived leads |
| `types.ts` | Remove phantom fields |

