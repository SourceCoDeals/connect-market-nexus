

# Fix: Prevent Remarketing Deals from Leaking into Public Marketplace Views

## The Problem

The "Similar Listings" section (and several other queries) fetches all active listings without filtering out internal/remarketing deals (`is_internal_deal = true`). This leaks confidential remarketing data to public marketplace users.

## Root Cause

The `is_internal_deal` filter was added to the main marketplace listing query but was never applied to the similar listings hook or several analytics hooks that also query the `listings` table.

## Fix: Add `is_internal_deal = false` Filter to All Public-Facing Queries

Every query that surfaces listings to marketplace (non-admin) users must include `.eq('is_internal_deal', false)`.

### Critical (user-visible data leak):

| File | Line(s) | What it does |
|------|---------|-------------|
| `src/hooks/use-similar-listings.ts` | 16-20 | **Similar Listings carousel** -- the bug in the screenshot |
| `src/hooks/use-simple-listings.ts` (fetchMetadata) | 87-93 | Category/location filter options -- could expose internal categories |
| `src/hooks/marketplace/use-listings.ts` | 210-215 | Single listing fetch by ID -- could return an internal deal if someone navigates to it directly |

### Secondary (admin analytics, lower risk but still incorrect data mixing):

| File | What it does |
|------|-------------|
| `src/hooks/use-market-intelligence.ts` | Pricing intelligence -- mixes internal deal financials into market data |
| `src/hooks/use-revenue-optimization.ts` | Revenue analytics |
| `src/hooks/use-automated-intelligence.ts` | Automated intelligence |
| `src/hooks/usePremiumAnalytics.ts` | Premium analytics |
| `src/hooks/useEngagementAnalytics.ts` | Engagement analytics |
| `src/hooks/use-listing-intelligence.ts` | Listing intelligence |
| `src/hooks/useListingHealth.ts` | Listing health |
| `src/hooks/use-smart-alerts.ts` | Smart alerts |
| `src/hooks/use-revenue-intelligence.ts` | Revenue intelligence |

For admin analytics hooks, the filter depends on intent -- if analytics should cover all deals, no change is needed. But the **three critical files** above must be fixed unconditionally.

## Technical Changes

For each critical file, add `.eq('is_internal_deal', false)` to the Supabase query:

**`use-similar-listings.ts`** (line 19, after `.eq('status', 'active')`):
```typescript
.eq('is_internal_deal', false)
```

**`use-simple-listings.ts` fetchMetadata** (line 91, after `.eq('status', 'active')`):
```typescript
.eq('is_internal_deal', false)
```

**`marketplace/use-listings.ts` single listing fetch** (line 214, after `.is('deleted_at', null)`):
```typescript
.eq('is_internal_deal', false)
```

These are one-line additions in three files. No other logic changes needed.

