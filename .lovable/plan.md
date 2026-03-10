

## Bug: SourceCo deals not appearing in Active Deals after push

### Root Cause

The Active Deals query in `useDealsData.ts` (line 97-100) has a hard-coded filter on `deal_source` that does **not** include `sourceco`:

```
deal_source.in.(marketplace,manual,referral,remarketing,salesforce_remarketing),
and(deal_source.in.(captarget,valuation_calculator,valuation_lead,gp_partners),pushed_to_all_deals.eq.true)
```

SourceCo deals have `deal_source = 'sourceco'`. Since `sourceco` is missing from both filter groups, pushed SourceCo deals are excluded from the query results entirely.

### Fix

**File**: `src/pages/admin/remarketing/ReMarketingDeals/useDealsData.ts` (line 98-99)

Add `sourceco` to the second filter group (sources that require `pushed_to_all_deals = true`):

```
'deal_source.in.(marketplace,manual,referral,remarketing,salesforce_remarketing),' +
  'and(deal_source.in.(captarget,valuation_calculator,valuation_lead,gp_partners,sourceco),pushed_to_all_deals.eq.true)',
```

This is a one-line change. SourceCo deals will appear in Active Deals only after being explicitly pushed (same behavior as CapTarget and valuation leads).

