

# Archive Active Deals with Fake Websites / Generic Names

## What We Found

There are **70 active deals** in the pipeline that have fake/placeholder websites (no real company website). These break down into:
- **35** with pattern `unknown-{uuid}.placeholder` 
- **35** with pattern `{name}-{hash}.unknown`
- **7** of these also have a generic title of "Backfilled Deal"

Of these 70 deals, **61 are tied to listings on the public marketplace** -- those marketplace listings stay untouched.

## What We'll Do

Run a single SQL migration that **soft-deletes** (sets `deleted_at = now()`) these 70 deals from the active pipeline, while leaving their parent marketplace listings completely untouched.

**Deals archived:** Any deal where:
1. `deleted_at IS NULL` (not already archived)
2. Stage type is `active` (not already closed won/lost)
3. The linked listing's website matches `unknown-%.placeholder` OR `%.unknown`

**What is NOT touched:**
- The `listings` table -- marketplace listings remain published and visible
- Closed Won / Closed Lost deals (already terminal)
- Deals with real websites
- Any other table (connection_requests, remarketing_scores, etc.)

## Technical Details

### Migration SQL

```sql
-- Soft-delete active deals whose listings have placeholder/fake websites
-- This does NOT touch the listings table or marketplace visibility
UPDATE deals
SET deleted_at = now()
WHERE deleted_at IS NULL
  AND stage_id IN (
    SELECT id FROM deal_stages WHERE stage_type = 'active'
  )
  AND listing_id IN (
    SELECT id FROM listings 
    WHERE website LIKE 'unknown-%.placeholder'
       OR website LIKE '%.unknown'
  );
```

This is a single, safe, reversible operation. If any deal needs to be restored, the existing `restore_soft_deleted` RPC can unarchive it.

### Scope Summary

| Metric | Count |
|--------|-------|
| Active deals archived | ~70 |
| Marketplace listings affected | 0 |
| Closed deals affected | 0 |
| Reversible? | Yes (soft delete) |

