# MARKETPLACE ↔ REMARKETING INTEGRATION AUDIT
## Phase 1: Current State Mapping

**Date**: February 20, 2026
**Status**: IN PROGRESS — awaiting full schema analysis completion

---

## 1. High-Level Architecture

### What Exists Today

The marketplace and remarketing tools share a single Supabase instance and a single React app. Remarketing pages live under `/admin/remarketing/`. Remarketing deals were migrated INTO the `listings` table — differentiated by the `deal_source` column.

### Entity Map (Current State)

| Real-World Entity | Marketplace Table(s) | Remarketing Table(s) | Linked? |
|---|---|---|---|
| Company for sale | `listings` | `listings` (same table, `deal_source` differentiates) | YES — same table |
| Buyer (firm) | `firm_agreements` + `firm_members` + `profiles` | `remarketing_buyers` | PARTIAL — `marketplace_firm_id` FK exists in migration but may not be applied |
| Fee agreement | `firm_agreements.fee_agreement_signed` | `remarketing_buyers.has_fee_agreement` | PARTIAL — sync trigger exists in migration |
| CRM pipeline deal | `deals` (tracks buyer ↔ listing engagement) | N/A (remarketing has no CRM pipeline) | NO overlap — different concepts |
| Buyer engagement | `connection_requests`, `saved_listings` | `buyer_deal_scores`, `outreach_records` | NOT LINKED |

---

## 2. Listings Table (Shared — "Company for Sale")

The `listings` table is the unified source of truth for ALL companies for sale. Remarketing deals were migrated in from a standalone system.

### deal_source Values
- `captarget` — Imported from CapTarget Google Sheet
- `gp_partners` — GP Partner deal sourcing
- `valuation_calculator` / `valuation_lead` — From valuation calculator leads
- `marketplace` — Originated from marketplace
- `manual` — Manually created by admin
- `NULL` — Legacy/default

### Visibility Control
- `is_internal_deal` — `true` = remarketing-only, `false` = marketplace-visible
- `status` — `active`, `inactive`, `archived`, `sold`, `pending`
- `deleted_at` — Soft delete
- `published_at` — When published to marketplace

### CRITICAL GAP: Single Status Field
There is only ONE `status` column. Archiving a deal in remarketing ALSO archives it on the marketplace. **No `marketplace_status` / `remarketing_status` separation exists.**

### Database Constraints
- `listings_marketplace_requires_image` — `is_internal_deal = false` requires `image_url IS NOT NULL`
- `listings_publish_required` — `is_internal_deal = false` requires `published_at IS NOT NULL`

---

## 3. Buyer Entity Structure

### Marketplace Side
**`firm_agreements`** — The "firm" entity. NOT just agreements — it IS the firm record.
- `id` UUID PK
- `primary_company_name` TEXT
- `normalized_company_name` TEXT
- `website_domain` TEXT
- `email_domain` TEXT
- `company_name_variations` TEXT[]
- `fee_agreement_signed` BOOLEAN
- `fee_agreement_signed_at` TIMESTAMPTZ
- `nda_signed` BOOLEAN
- `nda_signed_at` TIMESTAMPTZ
- `member_count` INTEGER
- `metadata` JSONB

**`firm_members`** — Links profiles to firms
- `firm_id` → `firm_agreements.id`
- `user_id` → `profiles.id` (nullable)
- `member_type` — `'marketplace_user'` | `'lead'`
- `lead_email`, `lead_name`, `lead_company` (for non-registered leads)
- `connection_request_id` → tracks which request brought them in
- `is_primary_contact` BOOLEAN

### Remarketing Side
**`remarketing_buyers`** — Flat table, each row is one buyer entity
- `id` UUID PK
- `company_name` TEXT
- `company_website` TEXT
- `buyer_type` — `'pe_firm'` | `'platform'` | `'strategic'` | `'family_office'` | `'other'`
- `pe_firm_name` TEXT (the parent PE firm for platform buyers)
- `pe_firm_website` TEXT
- `email_domain` TEXT
- `has_fee_agreement` BOOLEAN
- `marketplace_firm_id` UUID → `firm_agreements.id` (BRIDGE — from migration 20260219200000)
- `fee_agreement_source` TEXT — `'pe_firm_inherited'` | `'platform_direct'` | `'manual_override'` | `'marketplace_synced'`
- `universe_id` → `remarketing_buyer_universes.id`
- `thesis_summary`, `notes`, `fit_criteria_json`, etc.
- `archived` BOOLEAN

### Bridge Status
Migration `20260219200000_unify_fee_agreements.sql` exists locally with:
1. `marketplace_firm_id` FK column on `remarketing_buyers`
2. Domain-based auto-linking (pe_firm_website, company_website, email_domain)
3. Fee agreement propagation from `firm_agreements` to `remarketing_buyers`
4. Trigger `sync_fee_agreement_to_remarketing` for bidirectional sync
5. PE firm → platform inheritance

**Status: UNKNOWN if applied to live database.**

---

## 4. CRM Pipeline ("deals" table)

The marketplace `deals` table is a CRM pipeline — it tracks **buyer engagement with listings**, NOT the companies for sale themselves.

| Column | Type | Purpose |
|---|---|---|
| `listing_id` | UUID FK → listings | Which listing (company) |
| `stage_id` | UUID FK → deal_stages | Pipeline stage |
| `connection_request_id` | UUID FK | Original buyer request |
| `inbound_lead_id` | UUID FK | Original inbound lead |
| `contact_name/email/company/phone/role` | TEXT | Buyer contact info |
| `nda_status` | TEXT | Per-deal NDA tracking |
| `fee_agreement_status` | TEXT | Per-deal fee agreement tracking |
| `source` | TEXT | `manual`, `marketplace`, `webflow`, `import` |
| `priority`, `probability`, `value` | Various | Deal pipeline metadata |

**This table does NOT conflict with remarketing.** Remarketing doesn't have an equivalent — it uses `buyer_deal_scores` for matching but not a CRM pipeline.

---

## 5. Frontend Route Map

### Marketplace Routes
| Route | Component | Purpose |
|---|---|---|
| `/marketplace` | `Marketplace.tsx` | Public listing browse (filters `is_internal_deal = false`) |
| `/listings/:id` | `ListingDetail.tsx` | Public listing detail |
| `/admin/pipeline` | Pipeline page | CRM pipeline (queries `deals` table) |
| `/admin` | Admin page (tabs) | Users + Firm Agreements tabs |

### Remarketing Routes (under `/admin/remarketing/`)
| Route | Component | Data Source |
|---|---|---|
| `/dashboard` | `ReMarketingDashboard` | `listings` (all, grouped by deal_source) |
| `/deals` | `ReMarketingDeals` | `listings` (filters out gp_partners, unpushed valuation) |
| `/captarget` | `CapTargetDeals` | `listings` where `deal_source = 'captarget'` |
| `/gp-partner-deals` | `GPPartnerDeals` | `listings` where `deal_source = 'gp_partners'` |
| `/valuation-leads` | `ValuationLeads` | `valuation_leads` table |
| `/buyers` | `ReMarketingBuyers` | `remarketing_buyers` table |
| `/universes` | Universes list | `remarketing_buyer_universes` |
| `/universes/:id` | Universe detail | Buyers + deals in universe |
| `/deals/:id` | Deal detail | Single listing with enrichment data |
| `/analytics` | Analytics | `listing_analytics` |

### Cross-System Navigation
- **Marketplace → Remarketing**: NO direct link from marketplace listing to remarketing deal view
- **Remarketing → Marketplace**: NO link from remarketing buyer to marketplace firm profile
- **Sidebar**: Two distinct sections — feels like two apps stitched together

---

## 6. Edge Function Inventory (105 functions)

### Known Duplicate
| Function A | Function B | Status |
|---|---|---|
| `extract-deal-transcript` | `extract-transcript` | Both exist, need to check which is deployed/called |

### No `rm-` Prefixed Functions
All remarketing functions were already merged into the main namespace. No standalone `rm-*` functions exist.

### Function Categories
- **Enrichment**: `enrich-deal`, `enrich-buyer`, `enrich-external-only`, `enrich-geo-data`, `enrich-session-metadata`, `process-enrichment-queue`, `process-buyer-enrichment-queue`
- **Scoring**: `score-buyer-deal`, `calculate-deal-quality`, `calculate-valuation-lead-score`, `recalculate-deal-weights`, `process-scoring-queue`, `score-industry-alignment`
- **AI/Chat**: `chat-remarketing`, `chat-buyer-query`
- **Extraction**: `extract-deal-transcript`, `extract-transcript`, `extract-deal-document`, `extract-buyer-criteria`, `extract-buyer-transcript`
- **Email/Notifications**: 15+ send-* functions
- **Import**: `sync-captarget-sheet`, `bulk-import-remarketing`, `import-reference-data`
- **Analytics**: `aggregate-daily-metrics`, `track-session`, `track-engagement-signal`

---

## 7. Known Broken Features

| Feature | Status | Root Cause (Suspected) |
|---|---|---|
| Firm Agreements page ("Loading firms...") | BROKEN | Likely RLS blocking `firm_agreements` query, or `firm_members` table missing/empty |
| All Buyers ("0 PE firms / 0 platforms") | BROKEN | `remarketing_buyers` table may be empty, or RLS blocking, or `buyer_type` NULL for all rows |
| Marketplace showing 22 listings | FIXED | `is_internal_deal` flag was incorrectly set; restored via SQL |
| Cross-system navigation | NOT IMPLEMENTED | No links between marketplace and remarketing views |
| Fee agreement visibility in remarketing | NOT IMPLEMENTED | Bridge migration may not be applied |
| Shared buyer identity | PARTIAL | `marketplace_firm_id` bridge exists in migration, unknown if applied |

---

## 8. Your Key Requirement: Independent Deal Lifecycle

**Requirement**: "Archive in remarketing ≠ archive on marketplace."

**Current State**: Single `status` column on `listings`. Changing it affects both systems.

**Required Change**: Need dual status fields or a remarketing-specific overlay:
- Option A: Add `remarketing_status` column to `listings` (remarketing reads this, marketplace reads `status`)
- Option B: Add `remarketing_archived` boolean (simpler, scoped)
- Option C: Separate `remarketing_deal_metadata` table with per-deal remarketing state

**Recommended**: Option A — `remarketing_status` column with values `active`, `archived`, `excluded`. Remarketing pages filter on `remarketing_status` instead of `status`. Marketplace pages continue using `status`. Default `remarketing_status = 'active'` for all existing rows.

---

## PHASE 1 STATUS: ~80% COMPLETE

Awaiting detailed schema analysis from background agents for:
- Complete column lists for all key tables
- Full RLS policy inventory
- Complete edge function purpose mapping
- Integration attempt history from migration analysis

Will update this document when agents complete, then present Phase 2 architecture recommendation.

---

*Document auto-generated during audit. Full details in background agent outputs.*
