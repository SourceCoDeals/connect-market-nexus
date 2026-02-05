
# Fix: Prevent Remarketing/Research Deals from Appearing in Marketplace

## Problem Summary
Research deals imported through the M&A Intelligence tool are appearing in the public marketplace. Currently:
- 80 active listings in the database
- Only 8 are linked via `remarketing_universe_deals` 
- 72 unlinked research deals (many with $0 revenue/EBITDA) are polluting the marketplace

The current filtering in `use-simple-listings.ts` only checks `remarketing_universe_deals`, but deals created via `AddDealDialog` and `DealImportDialog` don't get linked there.

## Solution: Add `is_internal_deal` Flag

### Database Changes
1. Add `is_internal_deal` boolean column to `listings` table
2. Default to `false` for existing legitimate marketplace listings
3. Set to `true` for all deals created through remarketing workflows
4. Backfill existing research deals

### Code Changes

**1. Database Migration**
```sql
-- Add flag column
ALTER TABLE listings 
  ADD COLUMN is_internal_deal BOOLEAN DEFAULT false;

-- Backfill: Mark deals that appear to be research deals
-- (created recently without remarketing link, low/zero financials)
UPDATE listings
SET is_internal_deal = true
WHERE id NOT IN (
  SELECT DISTINCT listing_id 
  FROM remarketing_universe_deals 
  WHERE listing_id IS NOT NULL
)
AND (revenue = 0 OR revenue IS NULL OR ebitda = 0)
AND created_at > '2026-02-01';
```

**2. Update Marketplace Query (use-simple-listings.ts)**
- Change filter from checking `remarketing_universe_deals` to simply: `.eq('is_internal_deal', false)`
- This is simpler and more performant (no sub-query needed)

**3. Update Deal Creation Workflows**
- `AddDealDialog.tsx`: Set `is_internal_deal: true` when creating new deals
- `DealImportDialog.tsx`: Set `is_internal_deal: true` for all imported deals
- `DealCSVImport.tsx`: Already links to universe, but also set `is_internal_deal: true` for safety

**4. Update Admin Listings**
- Add filter/badge in admin listings to distinguish internal vs marketplace deals
- Allow toggling `is_internal_deal` flag

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration for `is_internal_deal` column |
| `src/hooks/use-simple-listings.ts` | Replace sub-query with `.eq('is_internal_deal', false)` |
| `src/components/remarketing/AddDealDialog.tsx` | Add `is_internal_deal: true` to insert |
| `src/components/remarketing/DealImportDialog.tsx` | Add `is_internal_deal: true` to insert |
| `src/components/remarketing/DealCSVImport.tsx` | Add `is_internal_deal: true` to insert |
| `src/hooks/marketplace/use-listings.ts` | Update query to filter by `is_internal_deal` |
| `src/integrations/supabase/types.ts` | Add `is_internal_deal` to type definitions |

## Immediate vs Long-term Impact
- **Immediate**: The 72 research deals will be hidden from marketplace
- **Long-term**: All future deals created through remarketing tools will be properly isolated

## Technical Notes

The `is_internal_deal` approach is preferred over relying on `remarketing_universe_deals` because:
1. Single column check is faster than join/sub-query
2. Not all internal deals are assigned to a universe
3. Deals can exist as "research backlog" before being added to any universe
4. Cleaner separation of concerns

## Backfill Strategy

The migration will mark as internal any deal that:
- Is NOT linked to a remarketing universe
- Has $0 revenue OR $0 EBITDA
- Was created after Feb 1, 2026 (recent batch import)

This conservative approach avoids accidentally hiding legitimate marketplace listings.
