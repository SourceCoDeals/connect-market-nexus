
# Remarketing Data Isolation Fix: Deep Investigation & Resolution Plan

## Executive Summary

Remarketing/research deals are leaking into the public marketplace because listings are being created **without** the `is_internal_deal = true` flag, and the database triggers only fire when deals are linked to universes or scored (which doesn't happen for all imported deals).

---

## Root Cause Analysis

### 1. The Problem
28 marketplace-visible listings are actually research deals that should never appear publicly. These include deals like "Combined Comfort Systems", "Auto Body Brothers", and "SHORELINE AUTO BODY".

### 2. How the System is Supposed to Work

```text
+---------------------+     +----------------------+     +-------------------+
| Create Deal         | --> | Link to Universe OR  | --> | Trigger fires:    |
| (set is_internal_   |     | Score calculated     |     | is_internal_deal  |
|  deal = true)       |     |                      |     | = true            |
+---------------------+     +----------------------+     +-------------------+
                                                                   |
                                                                   v
                                                         +-----------------------+
                                                         | Marketplace query     |
                                                         | filters out:          |
                                                         | .eq('is_internal_     |
                                                         |      deal', false)    |
                                                         +-----------------------+
```

### 3. Where the Isolation Breaks Down

**Primary Failure Point: Admin Listings Creation (`use-create-listing.ts`)**
```typescript
// Line 47 in src/hooks/admin/listings/use-create-listing.ts
is_internal_deal: false, // Admin-created listings are for the marketplace
```

This is **correct design** for legitimate marketplace listings created via `/admin/listings`. However, the leaky deals were created at `2026-02-05 05:27:xx`, which is today, and they have:
- `website` populated (typical of remarketing deals)
- `is_internal_deal = false`
- `score_count = 0` and `universe_count = 0` (never linked to remarketing system)

**Likely Source: Bulk Import Without Proper Flagging**
The problematic listings were created via an import mechanism that:
1. Inserted listings without `is_internal_deal = true`
2. Never linked them to a universe or scored them (so triggers never fired)
3. Left them visible on the public marketplace

**The Existing Triggers Are Insufficient**
The triggers (`trg_mark_listing_internal_on_score`, `trg_mark_listing_internal_on_universe_deal`) only fire on INSERT into `remarketing_scores` or `remarketing_universe_deals`. Deals that are imported but never added to a universe or scored will remain with `is_internal_deal = false`.

---

## Identified Code Entry Points for Listings

| Entry Point | Location | Sets `is_internal_deal` |
|------------|----------|-------------------------|
| Admin Listings Form | `use-create-listing.ts` | `false` (intended for marketplace) |
| Remarketing Add Deal | `AddDealDialog.tsx` | `true` |
| Add Deal to Universe | `AddDealToUniverseDialog.tsx` | `true` |
| CSV Import (All Deals) | `DealImportDialog.tsx` | `true` |
| CSV Import (Universe) | `DealCSVImport.tsx` | `true` |
| Bulk Import Edge Fn | Does NOT create listings | N/A (maps to existing) |

---

## Recommended Fix: Multi-Layer Defense

### Layer 1: Immediate Data Cleanup (Migration)
Run a SQL migration to fix all listings that look like research deals but are showing on the marketplace:
- Flag listings with `website` populated that have collision/hvac/roofing patterns in title
- Flag listings created in suspicious time windows
- Flag any listing that has remarketing-typical characteristics

### Layer 2: Database Default Protection
Change the `is_internal_deal` column default to `true`. This is a "fail-safe" approach:
- New listings default to being hidden from marketplace
- Only explicit marketplace publishing (via admin form) sets it to `false`
- Research imports are automatically protected

### Layer 3: Admin Form Protection
Add an explicit confirmation/toggle in the admin listings form:
- "Publish to Marketplace" checkbox (defaults to ON for admin form)
- When ON, sets `is_internal_deal = false`
- Makes the intent explicit and auditable

### Layer 4: Route-Based Access Control
Create a "marketplace publishing" permission check:
- Only listings created via `/admin/listings` route can set `is_internal_deal = false`
- Edge functions and other entry points require explicit service-role override

### Layer 5: Validation Trigger
Add a database trigger that validates listings cannot have `is_internal_deal = false` if they have remarketing-style fields populated (like `website` without proper marketplace metadata).

---

## Implementation Details

### Phase 1: Emergency Data Fix (Immediate)
Create a migration that:
1. Identifies all listings showing on marketplace (`is_internal_deal = false`)
2. Cross-references with remarketing indicators (website present, collision/hvac/roofing patterns)
3. Force-sets `is_internal_deal = true` for matching records

```sql
-- Identify and fix leaked deals
UPDATE listings
SET is_internal_deal = true, updated_at = now()
WHERE deleted_at IS NULL
  AND coalesce(is_internal_deal, false) = false
  AND website IS NOT NULL
  AND (
    -- Recent suspicious batch (today's imports)
    created_at >= '2026-02-05 05:00:00'
    OR
    -- Known research-style patterns
    title ~* '(collision|auto body|hvac|plumbing|roofing|sheet metal)'
  );
```

### Phase 2: Database Schema Hardening
1. Change column default: `ALTER TABLE listings ALTER COLUMN is_internal_deal SET DEFAULT true;`
2. Add validation constraint or trigger to prevent accidental marketplace publishing

### Phase 3: Admin UI Enhancement
1. Modify `use-create-listing.ts` to include explicit "Publish to Marketplace" flag
2. Add UI toggle in `ImprovedListingEditor.tsx` with clear labeling
3. Add confirmation dialog when publishing to marketplace

### Phase 4: Import Flow Hardening
1. Ensure all import dialogs forcibly set `is_internal_deal = true`
2. Add logging/audit trail for any listing creation
3. Create a dedicated "Marketplace Publisher" edge function with explicit permission checks

---

## Technical Implementation Tasks

### Task 1: Data Cleanup Migration
- Create SQL migration to fix existing leaked deals
- Target: All listings with `is_internal_deal = false` that have website field populated and match research patterns

### Task 2: Schema Default Change
- Alter `listings.is_internal_deal` default to `true`
- This ensures any future imports/creations are protected by default

### Task 3: Admin Form Enhancement
- Add explicit "Publish to Marketplace" toggle in the listing editor
- Default to checked (for admin workflow)
- Clear visual indicator of marketplace vs internal status

### Task 4: Validation Trigger
- Create trigger that prevents `is_internal_deal = false` for listings that:
  - Have `website` field but no `hero_description`
  - Have remarketing-style categories (Collision, HVAC, etc.) without full marketplace metadata

### Task 5: Audit & Monitoring
- Add logging to track when `is_internal_deal` changes
- Create admin dashboard widget showing marketplace vs internal counts

---

## Expected Outcome

After implementation:
- 28 leaked deals will be immediately hidden from marketplace
- Future imports are protected by default (`is_internal_deal = true`)
- Admin form explicitly controls marketplace publishing
- Database triggers provide additional safety net
- Audit trail enables debugging if issues recur

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Legitimate listings hidden | Admin form defaults to "publish" mode |
| Performance impact | Triggers are lightweight UPDATE operations |
| Migration affects wrong listings | Criteria targets only recent suspicious batch |
| Breaking existing admin workflow | No change to admin form behavior except added clarity |

