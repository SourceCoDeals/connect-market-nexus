# Deal & Marketplace Architecture Guide

## Overview

The platform manages two distinct entity types — **deals** (internal pipeline) and **marketplace listings** (public buyer-facing) — backed by a single `listings` table with logical separation via views.

```
                    +------------------+
                    |    listings       |  <-- Physical table (source of truth)
                    |  (all columns)    |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
     +--------v---------+       +----------v-----------+
     |     deals         |       | marketplace_listings  |
     | (auto-updatable   |       | (auto-updatable       |
     |  view, deal cols) |       |  view, presentation   |
     |                   |       |  cols only)            |
     +-------------------+       +------------------------+
```

## Data Model

### The `listings` table

The physical storage layer. Contains ~175 columns serving both deals and marketplace listings. All foreign keys from other tables (connection_requests, data_room_documents, buyer_approve_decisions, etc.) reference `listings(id)`.

**Row types:**

- **Deal rows**: `source_deal_id IS NULL` — these are the original entity
- **Marketplace listing rows**: `source_deal_id IS NOT NULL` — created from a deal, linked back via FK

### The `deals` view

```sql
SELECT * FROM listings WHERE source_deal_id IS NULL
WITH LOCAL CHECK OPTION;
```

**Use for:** All internal deal pipeline operations — enrichment, scoring, remarketing, contacts, Salesforce sync, admin pipeline pages.

**Columns available:** All columns from `listings`. Marketplace-specific columns (hero_description, custom_sections, image_url, etc.) will be NULL for deal rows.

**CRUD:** Full INSERT/UPDATE/DELETE supported. The CHECK OPTION prevents accidentally creating marketplace listings through this view.

### The `marketplace_listings` view

```sql
SELECT id, title, description, hero_description, revenue, ebitda, ...
FROM listings WHERE source_deal_id IS NOT NULL
WITH LOCAL CHECK OPTION;
```

**Use for:** Buyer-facing marketplace pages, listing cards, listing detail pages, marketplace admin operations.

**Columns available:** Only presentation-relevant columns (no internal contacts, enrichment data, Salesforce fields, etc.)

**CRUD:** Full INSERT/UPDATE/DELETE supported. The CHECK OPTION ensures `source_deal_id` is always set.

## Single Source of Truth: Financial Data Flow

```
  Deal (source_deal_id IS NULL)
    |
    | revenue = $5M
    | ebitda = $1.2M
    | employees = 45
    |
    v  [trg_sync_deal_financials trigger]
    |
  Marketplace Listing (source_deal_id = deal.id)
    |
    | revenue = $5M  (synced from deal)
    | ebitda = $1.2M (synced from deal)
    | employees = 45  (synced from deal)
```

**Rule:** Deals are the single source of truth for financial data. When a deal's financials are updated, the `trg_sync_deal_financials` trigger automatically propagates changes to all marketplace listings created from that deal.

**Editor behavior:** When editing a marketplace listing that has a `source_deal_id`, the financial fields (revenue, EBITDA, team size) are **locked** in the UI with an "Inherited from source deal" badge. To change financial data, edit the source deal instead.

**Synced fields:** revenue, ebitda, ebitda_margin, full_time_employees, location, category, categories

## Creating a Marketplace Listing from a Deal

### Flow

1. Admin navigates to a deal and clicks "Create Marketplace Listing"
2. `CreateListingFromDeal.tsx` loads the deal data
3. AI content generation (`generate-lead-memo` edge function) creates an anonymous teaser
4. The `deal-to-listing-anonymizer.ts` strips identifying information
5. `ImprovedListingEditor` opens with pre-filled anonymized content
6. Financial fields are locked (inherited from deal)
7. Admin reviews presentation content (title, hero, description, sections) and publishes
8. A new row is inserted into `listings` with `source_deal_id = deal.id` and `is_internal_deal = false`

### Key files

| File                                                           | Purpose                                      |
| -------------------------------------------------------------- | -------------------------------------------- |
| `src/pages/admin/CreateListingFromDeal.tsx`                    | Main page orchestrating the creation flow    |
| `src/lib/deal-to-listing-anonymizer.ts`                        | Strips PII from deal data for public listing |
| `src/components/admin/ImprovedListingEditor.tsx`               | Form editor with deal-source awareness       |
| `src/components/admin/editor-sections/EditorFinancialCard.tsx` | Financial fields with read-only mode         |
| `supabase/functions/generate-lead-memo/index.ts`               | AI memo generation via Claude API            |
| `src/hooks/admin/listings/use-robust-listing-creation.ts`      | Mutation hook for creating listings          |

### Prerequisites

Before AI content generation can run:

1. The deal must have a **Full Lead Memo PDF** uploaded to the data room
2. The deal must have basic financial data (revenue, EBITDA)

## Column Ownership

### Deal-Only Columns (~137)

These columns exist on the `listings` table but are only meaningful for deal rows (visible through the `deals` view):

**Internal Identity:**

- `internal_company_name`, `internal_notes`, `internal_contact_info`
- `internal_salesforce_link`, `internal_deal_memo_link`
- `primary_owner_id`, `deal_owner_id`, `deal_identifier`, `deal_source`
- `is_internal_deal`, `is_priority_target`

**Scoring & Quality:**

- `deal_total_score`, `deal_size_score`, `revenue_score`, `ebitda_score`
- `linkedin_boost`, `quality_calculation_version`, `scoring_notes`

**Enrichment:**

- `enrichment_status`, `enriched_at`, `executive_summary`
- `linkedin_url`, `linkedin_employee_count`, `linkedin_employee_range`, `linkedin_headquarters`
- `google_maps_url`, `google_place_id`, `google_rating`, `google_review_count`

**Contacts:**

- `main_contact_name`, `main_contact_email`, `main_contact_phone`, `main_contact_title`

**Remarketing:**

- `remarketing_status`, `needs_owner_contact`, `need_buyer_universe`
- `universe_build_flagged`, `buyer_universe_description`, `buyer_universe_label`

**Salesforce Integration:**

- `sf_owner_id`, `sf_target_stage`, `sf_tier`, `sf_remarketing`, etc.

**CapTarget Integration:**

- `captarget_status`, `captarget_source_url`, `captarget_sheet_tab`, etc.

**Business Intelligence:**

- `customer_geography`, `customer_types`, `customer_concentration`
- `business_model`, `revenue_model`, `competitive_position`
- `management_depth`, `ownership_structure`, `investment_thesis`
- `growth_drivers`, `growth_trajectory`, `key_risks`

### Marketplace-Only Columns (~22)

These columns are only meaningful for marketplace listing rows (visible through the `marketplace_listings` view):

- `hero_description` — Short teaser displayed on listing card
- `custom_sections` — JSON array of content sections for listing detail page
- `image_url` — Hero image URL
- `status_tag` — Public status badge (e.g., "New", "Under LOI")
- `acquisition_type` — "add_on" or "platform"
- `description_html`, `description_json` — Rich text versions of description
- `source_deal_id` — FK to the source deal row
- `published_at`, `published_by_admin_id` — Publication tracking
- `pushed_to_marketplace`, `pushed_to_marketplace_at`, `pushed_to_marketplace_by`
- `metric_3_*`, `metric_4_*` — Custom display metrics
- `files` — Downloadable listing documents

### Shared Columns (~26)

Used by both deals and marketplace listings:

- `id`, `title`, `description`, `status`, `tags`
- `revenue`, `ebitda`, `ebitda_margin` (financial, synced from deal)
- `full_time_employees`, `part_time_employees`
- `location`, `address_city`, `address_state`, `address_country`, `address_zip`
- `category`, `categories`, `industry`
- `website`, `founded_year`, `number_of_locations`, `services`, `geographic_states`
- `visible_to_buyer_types`
- `created_at`, `updated_at`, `deleted_at`

## Dead Columns Removed (Phase 2)

These columns were identified as having zero code references and were dropped:

| Column                              | Reason                                 |
| ----------------------------------- | -------------------------------------- |
| `financial_followup_questions`      | Feature never implemented              |
| `seller_interest_analyzed_at`       | Feature never implemented              |
| `seller_interest_notes`             | Feature never implemented              |
| `linkedin_match_confidence`         | LinkedIn verification feature unused   |
| `linkedin_match_signals`            | LinkedIn verification feature unused   |
| `linkedin_verified_at`              | LinkedIn verification feature unused   |
| `industry_tier_name`                | Unused variant of industry_tier        |
| `manual_rank_set_at`                | Ranking timestamp never used           |
| `notes_analyzed_at`                 | Analysis timestamp never used          |
| `sf_record_type_id`                 | Orphaned Salesforce field              |
| `sf_previous_search_opportunity_id` | Orphaned Salesforce field              |
| `captarget_row_hash`                | Had unused UNIQUE index                |
| `fts`                               | PostgreSQL full-text vector never used |
| `status_label`                      | Replaced by status_tag                 |

## Deprecated Fields (Migration Path)

### `internal_primary_owner` (string) -> `primary_owner_id` (UUID FK)

**Status:** Deprecated but still used as fallback in 4 files.

**Files to update:**

- `src/utils/user-helpers.ts` — reads it in `createListingFromData`
- `src/hooks/use-similar-listings.ts` — included in SELECT and mapping
- `src/components/admin/InternalCompanyInfoDisplay.tsx` — displayed as fallback

**Migration:** Update these files to use `primary_owner_id` exclusively, then drop the column.

### `need_owner_contact` (boolean) -> `needs_owner_contact` (boolean)

**Status:** Column consolidated in Phase 1 migration. Database column dropped. All code references updated.

## Query Patterns

### Reading deals (admin pipeline)

```typescript
// Preferred: use the deals view
const { data } = await supabase
  .from('deals')
  .select('id, title, revenue, ebitda, deal_total_score, enrichment_status')
  .order('created_at', { ascending: false });

// Legacy (still works): use the listings table directly
const { data } = await supabase.from('listings').select('*').is('source_deal_id', null);
```

### Reading marketplace listings (buyer-facing)

```typescript
// Preferred: use the marketplace_listings view
const { data } = await supabase
  .from('marketplace_listings')
  .select('id, title, hero_description, revenue, ebitda, image_url, status_tag')
  .eq('status', 'active');

// Legacy (still works): use the listings table directly
const { data } = await supabase
  .from('listings')
  .select('*')
  .not('source_deal_id', 'is', null)
  .eq('is_internal_deal', false);
```

### Creating a deal

```typescript
const { data } = await supabase
  .from('deals') // or 'listings'
  .insert({
    title: 'Company ABC',
    revenue: 5000000,
    ebitda: 1200000,
    internal_company_name: 'ABC Corp',
    is_internal_deal: true,
    // source_deal_id is automatically NULL (deal row)
  });
```

### Creating a marketplace listing from a deal

```typescript
const { data } = await supabase
  .from('marketplace_listings')  // or 'listings'
  .insert({
    title: 'Southeast IT Services Provider',  // anonymized
    source_deal_id: dealId,                   // required (CHECK OPTION enforces)
    hero_description: '...',
    custom_sections: [...],
    is_internal_deal: false,
    // Financial data is synced from the deal automatically
  });
```

### Updating deal financials (auto-syncs to marketplace)

```typescript
// Update the deal — trigger syncs to all marketplace listings
const { error } = await supabase
  .from('deals')
  .update({ revenue: 6000000, ebitda: 1500000 })
  .eq('id', dealId);
// The marketplace listing's revenue/ebitda are now updated automatically
```

## Migration Guide: Updating Existing Code

When updating files from `listings` to the appropriate view:

1. **Identify context:** Is this file dealing with deals or marketplace?
2. **Change the table name:** `.from('listings')` -> `.from('deals')` or `.from('marketplace_listings')`
3. **Reduce column selection:** The marketplace view only has ~40 columns. Remove deal-only columns from `.select()`.
4. **Remove row filters:** You no longer need `.eq('is_internal_deal', true)` or `.is('source_deal_id', null)` — the view handles this.
5. **Test:** Build and verify the page still works.

### Files to migrate (priority order)

**High priority (deal pipeline):**

- `src/pages/admin/remarketing/*/` — All remarketing pages should use `deals` view
- `src/pages/admin/pipeline/` — Pipeline pages should use `deals` view
- `supabase/functions/enrich-deal/` — Should use `deals` view
- `supabase/functions/calculate-deal-quality/` — Should use `deals` view

**High priority (marketplace):**

- `src/pages/marketplace/` — All buyer pages should use `marketplace_listings` view
- `src/components/ListingCard.tsx` — Should use `marketplace_listings` view

**Medium priority (admin mixed):**

- `src/pages/admin/ListingsManagement*.tsx` — Uses both, may need two queries

**Low priority (edge functions):**

- Most edge functions operate on specific IDs and can keep using `listings` for now

## Architecture Decisions

### Why views instead of physical tables?

30+ tables have foreign key references to `listings(id)`. A physical table split would require:

- Dropping and recreating FK constraints on all referencing tables
- Migrating data with potential ID conflicts
- Complex backward-compatible routing for shared IDs

The view approach provides identical developer experience while preserving FK integrity. The `listings` table remains the storage layer; the views provide clean column and row separation.

### Why keep the `listings` table?

1. **FK integrity:** 30+ tables reference `listings(id)`
2. **Zero-breakage migration:** All 251 files that query `listings` continue to work
3. **Incremental migration:** Each file can be updated independently, at any pace
4. **Single write path:** The sync trigger only needs to watch one table

### Future: Physical table split (Phase 3)

When all frontend code has been migrated to use `deals`/`marketplace_listings` views:

1. Create physical `deals` and `marketplace_listings` tables
2. Migrate FK constraints from referencing tables
3. Drop the `listings` table
4. Rename the physical tables to match the view names

This can be done when there are zero remaining `.from('listings')` calls in the codebase.

## Edge Functions

### Key edge functions for the deal pipeline

| Function                   | Purpose                                          | Table Used |
| -------------------------- | ------------------------------------------------ | ---------- |
| `generate-lead-memo`       | AI memo generation (requires Full Lead Memo PDF) | `listings` |
| `publish-listing`          | Validates and publishes marketplace listing      | `listings` |
| `enrich-deal`              | Deal enrichment (LinkedIn, Google, etc.)         | `listings` |
| `calculate-deal-quality`   | Quality scoring for deal pipeline                | `listings` |
| `process-enrichment-queue` | Background enrichment processing                 | `listings` |
| `score-deal-buyers`        | Buyer-deal matching                              | `listings` |

All edge functions currently use `listings` directly. They can be incrementally migrated to use the appropriate view.

## Hooks

| Hook                       | Purpose                                | Preferred View                         |
| -------------------------- | -------------------------------------- | -------------------------------------- |
| `useRobustListingCreation` | Creates listings (deal or marketplace) | `listings` (routes via source_deal_id) |
| `useUpdateListing`         | Updates any listing                    | `deals` or `marketplace_listings`      |
| `useDeleteListing`         | Soft-deletes a listing                 | `listings`                             |
| `useToggleListingStatus`   | Toggles active/inactive                | `deals` or `marketplace_listings`      |
| `useGenerateMemo`          | Triggers AI memo generation            | N/A (edge function)                    |
