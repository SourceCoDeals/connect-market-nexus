# MARKETPLACE ↔ REMARKETING INTEGRATION AUDIT

**Date**: February 20, 2026
**Status**: PHASE 1 COMPLETE — Phase 2 Architecture Recommendation included

---

## PHASE 1: CURRENT STATE MAPPING

---

## 1. High-Level Architecture

### What Exists Today

The marketplace and remarketing tools share a single Supabase instance and a single React app. Remarketing pages live under `/admin/remarketing/`. Remarketing deals were migrated INTO the `listings` table — differentiated by the `deal_source` column.

**Two different funnels, no shared pipeline:**
- **Marketplace** = Inbound funnel. Buyers find listings, submit connection requests, which become pipeline deals.
- **Remarketing** = Outbound funnel. Admins find buyers, score them against deals, select for outreach, track engagement.
- **The gap**: These two funnels never converge. Once a remarketing buyer says "I'm interested," there's no mechanism to move them into the same CRM pipeline as marketplace buyers.

### Entity Map (Current State)

| Real-World Entity | Marketplace Table(s) | Remarketing Table(s) | Linked? |
|---|---|---|---|
| Company for sale | `listings` | `listings` (same table, `deal_source` differentiates) | YES — same table |
| Buyer (firm) | `firm_agreements` + `firm_members` + `profiles` | `remarketing_buyers` (60+ columns) | PARTIAL — `marketplace_firm_id` FK exists in migration, unknown if applied |
| Fee agreement | `firm_agreements.fee_agreement_signed` | `remarketing_buyers.has_fee_agreement` | PARTIAL — sync trigger exists in migration |
| CRM pipeline deal | `deals` (tracks buyer ↔ listing engagement) | **NONE** — remarketing has no CRM pipeline | NOT LINKED |
| Buyer engagement | `connection_requests`, `saved_listings` | `remarketing_scores`, `outreach_records` | NOT LINKED |
| Buyer contacts | `firm_members` (user + lead records) | `remarketing_buyer_contacts` (per-buyer contacts) | NOT LINKED |

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
- `primary_company_name`, `normalized_company_name` TEXT
- `website_domain`, `email_domain` TEXT
- `company_name_variations` TEXT[]
- `fee_agreement_signed` BOOLEAN + `fee_agreement_signed_at` TIMESTAMPTZ
- `nda_signed` BOOLEAN + `nda_signed_at` TIMESTAMPTZ
- `member_count` INTEGER, `metadata` JSONB

**`firm_members`** — Links profiles to firms
- `firm_id` → `firm_agreements.id`
- `user_id` → `profiles.id` (nullable)
- `member_type` — `'marketplace_user'` | `'lead'`
- `lead_email`, `lead_name`, `lead_company` (for non-registered leads)
- `connection_request_id` → tracks which request brought them in
- `is_primary_contact` BOOLEAN

### Remarketing Side
**`remarketing_buyers`** — Flat table, each row is one buyer entity (60+ columns)
- `id` UUID PK
- `company_name`, `company_website`, `buyer_type` (pe_firm|platform|strategic|family_office|other)
- `pe_firm_name`, `pe_firm_website`, `pe_firm_id` (self-reference for PE → platform relationship)
- `email_domain`, `detected_email_pattern`
- Target criteria: `target_revenue_min/max`, `target_ebitda_min/max`, `target_geographies[]`, `target_services[]`, `target_industries[]`
- Portfolio: `recent_acquisitions` JSONB, `portfolio_companies` JSONB, `total_acquisitions` INTEGER
- Geography: `hq_city`, `hq_state`, `hq_region`, `geographic_footprint[]`, `operating_locations[]`
- Bridge: `marketplace_firm_id` UUID → `firm_agreements.id`
- Fee: `has_fee_agreement` BOOLEAN, `fee_agreement_source` TEXT
- `universe_id` → `remarketing_buyer_universes.id`
- `archived` BOOLEAN

**`remarketing_buyer_contacts`** — Contact records per buyer
- `buyer_id` → `remarketing_buyers.id` (CASCADE)
- `name`, `email`, `phone`, `role`, `role_category`
- `linkedin_url`, `is_primary_contact`, `is_deal_team`
- `email_confidence`, `source`, `priority_level`

### Bridge Status
Migration `20260219200000_unify_fee_agreements.sql` exists locally with:
1. `marketplace_firm_id` FK column on `remarketing_buyers`
2. Domain-based auto-linking (pe_firm_website, company_website, email_domain)
3. Fee agreement propagation from `firm_agreements` to `remarketing_buyers`
4. Trigger `sync_fee_agreement_to_remarketing` for bidirectional sync
5. PE firm → platform inheritance

**Status: UNKNOWN if applied to live database.**

---

## 4. CRM Pipeline ("deals" table) — THE CONVERGENCE TARGET

The marketplace `deals` table is a CRM pipeline — it tracks **buyer engagement with listings**, NOT the companies for sale themselves.

### Full Schema
| Column | Type | Purpose |
|---|---|---|
| `id` | UUID PK | |
| `listing_id` | UUID FK → listings | Which listing (company) |
| `stage_id` | UUID FK → deal_stages | Pipeline stage (required) |
| `title` | TEXT | Deal title (required) |
| `connection_request_id` | UUID FK | Original buyer request (marketplace path) |
| `inbound_lead_id` | UUID FK | Original inbound lead |
| `contact_name/email/company/phone/role` | TEXT | Buyer contact info |
| `assigned_to` | UUID FK → profiles | Deal owner |
| `nda_status` | TEXT | not_sent → sent → signed → declined |
| `fee_agreement_status` | TEXT | not_sent → sent → signed → declined |
| `source` | TEXT | `manual`, `marketplace`, `webflow`, `import` |
| `priority` | TEXT | low/medium/high/urgent |
| `probability` | INTEGER | 0-100 win probability |
| `value` | NUMERIC | Deal value |
| `expected_close_date` | DATE | |
| `followed_up` | BOOLEAN | Follow-up tracking |
| `buyer_priority_score` | INTEGER | Auto-calculated |
| `stage_entered_at` | TIMESTAMPTZ | Auto-updated on stage change |
| `deleted_at` | TIMESTAMPTZ | Soft delete |

### Pipeline Stages (11 default)
1. Sourced → 2. Qualified → 3. NDA Sent → 4. NDA Signed → 5. Fee Agreement Sent → 6. Fee Agreement Signed → 7. Due Diligence → 8. LOI Submitted → 9. Under Contract → 10. Closed Won → 11. Closed Lost

### Current Deal Creation Paths
- **Marketplace**: Connection request → deal (via `connection_request_id` FK)
- **Import**: Bulk CSV import creates connection requests → deals
- **Manual**: Admin creates deal manually
- **Remarketing**: **NONE** — no path exists to create a deal from remarketing buyer interest

### CRITICAL GAP: No Remarketing → Pipeline Path
The `source` field supports `manual`, `marketplace`, `webflow`, `import` — but NOT `remarketing`. When a remarketing buyer is marked as "interested" via `buyer_deal_scores.interested = true`, **nothing happens in the deals table**.

---

## 5. Remarketing Scoring & Outreach Flow (Current)

### Scoring Tables

**`remarketing_scores`** — Match scores between listings and buyers
- `listing_id` FK → listings, `buyer_id` FK → remarketing_buyers
- UNIQUE(listing_id, buyer_id)
- `composite_score`, `geography_score`, `size_score`, `service_score`, `owner_goals_score`
- `tier` (A/B/C/D), `status` (pending/approved/passed/hidden)
- `interested` BOOLEAN, `interested_at` TIMESTAMPTZ
- `selected_for_outreach` BOOLEAN
- `passed_on_deal` BOOLEAN, `pass_reason`, `rejection_reason`

**`buyer_deal_scores`** — Similar but linked to `deals` table (not listings)
- `deal_id` FK → deals (not listing_id)
- Same scoring columns + `selected_for_outreach`, `interested`, `passed_on_deal`

### Outreach Tables (TWO — likely one is legacy)

**`outreach_records`** — Detailed outreach progression
- `buyer_id`, `listing_id`, `score_id`, `universe_id`
- Contact progression: `contacted_at` → `nda_sent_at` → `nda_signed_at` → `cim_sent_at` → `meeting_scheduled_at`
- `outcome`: in_progress / won / lost / withdrawn / no_response
- `next_action`, `next_action_date`

**`remarketing_outreach`** — Simpler outreach tracking
- `buyer_id`, `listing_id`, `score_id`
- `status`: pending → contacted → responded → meeting_scheduled → loi_sent → closed_won → closed_lost
- `contact_method`, `contacted_at`, `response_at`, `meeting_at`

### Current Remarketing Flow (No Pipeline Integration)
```
1. Listing exists in listings table (is_internal_deal = true)
2. Admin assigns listing to universe via remarketing_universe_deals
3. Admin triggers scoring → score-buyer-deal edge function
4. remarketing_scores rows created with composite_score + tier
5. Admin reviews scores, marks buyer as "interested" / "selected_for_outreach"
6. Admin creates outreach_records entry, tracks contact progression
7. ← DEAD END: No conversion to deals pipeline
```

---

## 6. Frontend Route Map

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
| `/deals/:id` | Deal detail | Single listing + scoring/outreach data |
| `/matching/:listingId` | Deal matching | Score buyers against listing |
| `/analytics` | Analytics | `listing_analytics` |

### M&A Intelligence Routes (Third system — parallel to remarketing)
| Route | Component | Data Source |
|---|---|---|
| `/admin/ma-intelligence/trackers` | Trackers | `industry_trackers` |
| `/admin/ma-intelligence/deals` | Deals | `listings` (via trackers) |
| `/admin/ma-intelligence/buyers` | Buyers | `remarketing_buyers` (shared!) |

### Cross-System Navigation Gaps
- **Marketplace → Remarketing**: NO direct link from marketplace listing to remarketing deal view
- **Remarketing → Marketplace**: NO link from remarketing buyer to marketplace firm profile
- **Remarketing → Pipeline**: NO link from outreach to pipeline deal
- **Pipeline → Remarketing**: NO link from pipeline deal to remarketing scoring/outreach
- **Sidebar**: Two distinct sections — feels like two apps stitched together

---

## 7. Edge Function Inventory (117 functions)

### By Category
| Category | Count | Key Functions |
|---|---|---|
| Deal Enrichment | 5 | `enrich-deal`, `process-enrichment-queue`, `extract-deal-transcript`, `extract-transcript`, `analyze-deal-notes` |
| Buyer Enrichment | 2 | `enrich-buyer`, `process-buyer-enrichment-queue` |
| Scoring | 6 | `score-buyer-deal`, `calculate-deal-quality`, `calculate-valuation-lead-score`, `recalculate-deal-weights`, `process-scoring-queue`, `score-industry-alignment` |
| AI/Chat | 2 | `chat-remarketing`, `chat-buyer-query` |
| Transcript Extraction | 6 | `extract-deal-transcript`, `extract-transcript`, `extract-buyer-transcript`, `extract-buyer-criteria`, `extract-deal-document`, `parse-transcript-file` |
| Email/Notifications | 18 | `send-email-notification`, `send-deal-alert`, `notify-remarketing-match`, etc. |
| Import/Export | 3 | `sync-captarget-sheet`, `bulk-import-remarketing`, `import-reference-data` |
| Buyer Research | 4 | `find-buyer-contacts`, `query-buyer-universe`, `suggest-universe`, `generate-buyer-intro` |
| M&A Guides | 3 | `generate-ma-guide`, `generate-ma-guide-background`, `process-ma-guide-queue` |
| Fireflies Integration | 3 | `fetch-fireflies-content`, `sync-fireflies-transcripts`, `search-fireflies-for-buyer` |
| Analytics/Tracking | 6 | `aggregate-daily-metrics`, `track-session`, `track-engagement-signal`, `track-initial-session`, etc. |
| Auth/Security | 6 | `session-heartbeat`, `password-reset`, `otp-rate-limiter`, etc. |
| Data Utilities | 8 | `dedupe-buyers`, `publish-listing`, `create-lead-user`, `sync-missing-profiles`, etc. |

### Cross-System Bridge Functions
| Function | Reads | Writes | Bridge Role |
|---|---|---|---|
| `score-buyer-deal` | `listings` + `remarketing_buyers` + `remarketing_buyer_universes` | `remarketing_scores` | Core matching engine |
| `notify-remarketing-match` | `listings` + `remarketing_scores` + `remarketing_buyers` | `admin_notifications` | A-tier match alerts |
| `extract-transcript` | `call_transcripts` + `buyer_transcripts` + `listings` | Both systems | Dual-mode extraction |
| `chat-remarketing` | `listings` + `remarketing_buyers` + `remarketing_scores` + `call_transcripts` | Read-only | Cross-domain analysis |
| `publish-listing` | `listings` + `remarketing_universe_deals` | `listings` | Guards marketplace publishing |

### Confirmed Non-Duplicates
`extract-deal-transcript` and `extract-transcript` are NOT duplicates:
- `extract-deal-transcript`: Deal-specific, reads `deal_transcripts`, writes to `listings`
- `extract-transcript`: Dual-mode (deal or buyer or both), reads from `call_transcripts` + `buyer_transcripts`

---

## 8. RLS Policy Summary

### Pattern
| Table | Access Level |
|---|---|
| `listings` | Approved users can SELECT (soft-delete filtered); admins see all |
| `profiles` | Users see own; admins see all |
| `firm_agreements` | Approved users can SELECT; admins can ALL |
| `firm_members` | Users see own membership; admins can ALL |
| `deals` | Admins only (ALL) |
| `deal_stages` | Approved users can SELECT; admins can ALL |
| `remarketing_buyers` | Admins only (ALL) |
| `remarketing_buyer_universes` | Admins only (ALL) |
| `remarketing_scores` | Admins only (ALL) + soft-delete filter |
| `outreach_records` | Admins only (ALL) |
| `enrichment_queue` | Admins SELECT + manage; service role full |
| `buyer_enrichment_queue` | All authenticated users (permissive) |
| `remarketing_outreach` | All authenticated users (permissive) |
| `connection_requests` | Explicit policies NOT FOUND — potential gap |
| `saved_listings` | Explicit policies NOT FOUND — potential gap |

### Key Auth Mechanisms
- `auth.uid()` — Current user ID
- `is_admin(auth.uid())` — Custom function checking admin status
- Profile-based gates: `approval_status = 'approved'` + `email_verified = true`
- `auth.jwt() ->> 'is_admin'` — JWT claim check (used in newer policies)

---

## 9. Known Broken Features

| Feature | Status | Root Cause |
|---|---|---|
| Firm Agreements page ("Loading firms...") | BROKEN | Likely RLS blocking `firm_agreements` query for non-admin users, or `is_admin()` function issue |
| All Buyers ("0 PE firms / 0 platforms") | BROKEN | `remarketing_buyers` table may be empty, or `buyer_type` NULL for all rows |
| Marketplace showing 22 listings | FIXED | `is_internal_deal` flag incorrectly set + 42 listings archived; restored via SQL |
| Cross-system navigation | NOT IMPLEMENTED | No links between marketplace and remarketing views |
| Fee agreement visibility in remarketing | NOT IMPLEMENTED | Bridge migration (20260219200000) may not be applied |
| Shared buyer identity | PARTIAL | `marketplace_firm_id` bridge exists in migration, unknown if applied |
| Remarketing → Pipeline convergence | NOT IMPLEMENTED | No mechanism to convert interested buyers to pipeline deals |

---

## 10. Remarketing Table Inventory (Complete)

| Table | Purpose | Key FKs | Rows (est.) |
|---|---|---|---|
| `remarketing_buyer_universes` | Industry/criteria groupings for buyer cohorts | `created_by` → auth.users | — |
| `remarketing_buyers` | External buyer profiles (PE, platform, strategic) | `universe_id`, `pe_firm_id` (self), `marketplace_firm_id`, `industry_tracker_id` | — |
| `remarketing_buyer_contacts` | Contact records per buyer | `buyer_id` → remarketing_buyers (CASCADE) | — |
| `remarketing_scores` | Match scores: listing ↔ buyer | `listing_id` → listings, `buyer_id` → remarketing_buyers | — |
| `remarketing_universe_deals` | Junction: universe ↔ listing | `universe_id`, `listing_id` | — |
| `outreach_records` | Detailed outreach progression (NDA/CIM/meeting) | `buyer_id`, `listing_id`, `score_id` | — |
| `remarketing_outreach` | Simpler outreach status tracking | `buyer_id`, `listing_id`, `score_id` | — |
| `enrichment_queue` | Queue for enriching listings | `listing_id` → listings | — |
| `buyer_enrichment_queue` | Queue for enriching buyers | `buyer_id` → remarketing_buyers | — |
| `remarketing_scoring_queue` | Queue for batch scoring | `universe_id`, `buyer_id`, `listing_id` | — |
| `remarketing_guide_generation_state` | M&A guide generation progress | `universe_id` → universes | — |

---

## PHASE 1 STATUS: COMPLETE

All data gathering is finished. Phase 2 architecture follows.

---

---

## PHASE 2: TARGET ARCHITECTURE RECOMMENDATION

---

## The Vision: Two Funnels, One Pipeline

```
INBOUND (Marketplace)                    OUTBOUND (Remarketing)
========================                 ========================
Buyer browses marketplace                Admin identifies buyer targets
       ↓                                        ↓
Buyer submits connection request         Score buyers against deals
       ↓                                        ↓
connection_requests created              remarketing_scores created
       ↓                                        ↓
Admin reviews, creates deal              Admin marks buyer "interested"
       ↓                                        ↓
       ╰──────────────────╮  ╭──────────────────╯
                          ↓  ↓
                   ┌──────────────┐
                   │  deals table │  ← UNIFIED PIPELINE
                   │  (CRM)      │
                   └──────────────┘
                          ↓
               Sourced → Qualified → NDA → Fee Agreement
                          → Due Diligence → LOI → Closed
```

### Core Principle
The `deals` table IS the pipeline. Every buyer engagement — whether it arrived from marketplace or remarketing — lives here once it's actionable. Remarketing does the outbound work of finding and qualifying buyers. Once qualified, they join the same pipeline as inbound marketplace buyers.

---

## Architecture Decision: 4 Changes Required

### Change 1: Add `remarketing_status` to listings (Independent Lifecycle)

**Problem:** Single `status` column — archiving in remarketing archives on marketplace too.

**Solution:** Add `remarketing_status` column to `listings`.

```sql
ALTER TABLE listings ADD COLUMN remarketing_status TEXT
  DEFAULT 'active'
  CHECK (remarketing_status IN ('active', 'archived', 'excluded', 'completed'));

-- Backfill: all existing rows get 'active'
UPDATE listings SET remarketing_status = 'active' WHERE remarketing_status IS NULL;
```

**Rules:**
- Marketplace reads `status` (unchanged)
- Remarketing reads `remarketing_status` for filtering
- Archiving in remarketing sets `remarketing_status = 'archived'` — does NOT touch `status`
- Archiving on marketplace sets `status = 'archived'` — does NOT touch `remarketing_status`
- `completed` = remarketing process finished (all buyers contacted, deal won/lost)

**Frontend impact:** All remarketing pages that filter by `status` must switch to `remarketing_status`. Marketplace pages unchanged.

---

### Change 2: Remarketing → Pipeline Bridge (The Convergence)

**Problem:** When remarketing marks a buyer as "interested," nothing enters the deals pipeline.

**Solution:** When a remarketing buyer is approved/interested, create a `deals` row.

**New `source` value:** Add `'remarketing'` to the deals `source` field.

**Trigger point:** When `remarketing_scores.interested = true` is set (or `outreach_records.outcome = 'won'` / meeting scheduled / NDA signed — configurable).

**Implementation — Two options:**

**Option A: Database trigger (automatic)**
```sql
CREATE FUNCTION convert_interested_buyer_to_deal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.interested = true AND (OLD.interested IS NULL OR OLD.interested = false) THEN
    INSERT INTO deals (listing_id, title, stage_id, contact_name, contact_email,
                       contact_company, source, remarketing_score_id, remarketing_buyer_id)
    SELECT
      NEW.listing_id,
      'RM: ' || rb.company_name || ' → ' || l.title,
      (SELECT id FROM deal_stages WHERE name = 'Qualified' LIMIT 1),
      rbc.name,
      rbc.email,
      rb.company_name,
      'remarketing',
      NEW.id,
      NEW.buyer_id
    FROM remarketing_buyers rb
    JOIN listings l ON l.id = NEW.listing_id
    LEFT JOIN remarketing_buyer_contacts rbc ON rbc.buyer_id = rb.id AND rbc.is_primary_contact = true
    WHERE rb.id = NEW.buyer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Option B: Edge function (manual/explicit — RECOMMENDED)**
- Admin clicks "Move to Pipeline" button on an interested buyer
- Edge function creates the deal, populates contact info from `remarketing_buyer_contacts`
- Admin can review/edit before it enters pipeline
- More control, less magic

**Required schema change on `deals` table:**
```sql
ALTER TABLE deals
  ADD COLUMN remarketing_score_id UUID REFERENCES remarketing_scores(id),
  ADD COLUMN remarketing_buyer_id UUID REFERENCES remarketing_buyers(id);

-- Update source check constraint to include 'remarketing'
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_source_check;
ALTER TABLE deals ADD CONSTRAINT deals_source_check
  CHECK (source IN ('manual', 'marketplace', 'webflow', 'import', 'remarketing'));
```

This enables:
- Pipeline view can show where each deal came from (marketplace vs remarketing)
- Deal detail can link back to remarketing scoring/outreach history
- Remarketing pages can show "Already in pipeline" badge for converted buyers

---

### Change 3: Unified Buyer Identity

**Problem:** Marketplace has `firm_agreements` + `firm_members`. Remarketing has `remarketing_buyers` + `remarketing_buyer_contacts`. Same real-world companies exist in both with no link.

**Solution:** Apply and strengthen the `marketplace_firm_id` bridge.

**Step 1:** Apply migration `20260219200000_unify_fee_agreements.sql` to live database (if not already applied). This adds:
- `marketplace_firm_id` FK on `remarketing_buyers` → `firm_agreements.id`
- Domain-based auto-linking
- Fee agreement sync trigger

**Step 2:** When a remarketing buyer is converted to a pipeline deal (Change 2), also:
- If `marketplace_firm_id` exists → use that firm for the deal
- If no firm exists → auto-create `firm_agreements` row + `firm_members` row from remarketing buyer data
- Link the deal's `connection_request_id` (or new equivalent) to the firm

**Step 3:** Make the link visible in UI:
- Remarketing buyer detail → show "Linked to marketplace firm: [name]" with link
- Firm agreements page → show "Also in remarketing as: [buyer name]" with link

---

### Change 4: Cross-System Navigation

**Problem:** No links between marketplace and remarketing views. Feels like two separate apps.

**Solution:** Add navigation bridges at key points.

| From | To | Trigger |
|---|---|---|
| Remarketing deal detail | Pipeline deal | When `deals` row exists for this listing + buyer |
| Pipeline deal detail | Remarketing scoring | When `remarketing_score_id` is set on deal |
| Firm agreements row | Remarketing buyer | When `marketplace_firm_id` bridge exists |
| Remarketing buyer detail | Firm agreements | When `marketplace_firm_id` bridge exists |
| Marketplace listing | Remarketing deal view | When `is_internal_deal` has matching remarketing data |
| Remarketing "interested" badge | Pipeline view (filtered) | Direct link to pipeline filtered by remarketing source |

---

## What This Architecture Achieves

### One Source of Truth Per Entity
- **Company for sale** → `listings` table (shared, `remarketing_status` for independent lifecycle)
- **Buyer** → `remarketing_buyers` (master) bridged to `firm_agreements` (marketplace identity)
- **Pipeline engagement** → `deals` table (unified, `source` indicates origin)

### Independent Lifecycles
- Archive in remarketing → sets `remarketing_status = 'archived'`, marketplace unaffected
- Archive on marketplace → sets `status = 'archived'`, remarketing unaffected
- A deal can be active in remarketing and archived on marketplace, or vice versa

### Merged Pipeline
- Marketplace connection request → deal (source = 'marketplace')
- Remarketing interested buyer → deal (source = 'remarketing')
- Both flow through same 11-stage pipeline
- Pipeline view shows all active engagements regardless of origin
- Kanban board, pipeline analytics, deal owner assignment — all unified

### Data Flow After Integration
```
Remarketing buyer scored A-tier → Admin reviews → Clicks "Move to Pipeline"
  → deals row created (source='remarketing', remarketing_buyer_id, remarketing_score_id)
  → Pipeline shows new deal in "Qualified" stage
  → Contact info auto-populated from remarketing_buyer_contacts
  → Firm auto-linked or created via marketplace_firm_id bridge
  → NDA/Fee Agreement tracking in deals table (same as marketplace deals)
  → Outreach history preserved via remarketing_score_id link back
```

---

## Implementation Priority

### Week 1: Foundation
1. Add `remarketing_status` column to listings + backfill
2. Add `remarketing_score_id` + `remarketing_buyer_id` columns to deals
3. Add `'remarketing'` to deals `source` constraint
4. Apply fee agreement bridge migration (20260219200000)

### Week 2: Pipeline Convergence
5. Create "Move to Pipeline" edge function
6. Add "Move to Pipeline" button to remarketing scoring UI
7. Update pipeline views to show remarketing-sourced deals with badge
8. Add link from pipeline deal back to remarketing scoring history

### Week 3: Frontend Integration
9. Switch all remarketing pages from `status` to `remarketing_status`
10. Add cross-system navigation links (firm ↔ buyer, deal ↔ scoring)
11. Add "Already in Pipeline" badges in remarketing views
12. Fix broken features (Firm Agreements page, All Buyers counts)

### Week 4: Polish
13. Unified dashboard showing both funnels
14. Pipeline analytics including remarketing source breakdown
15. Buyer identity dedup tooling (merge remarketing_buyers with firm_agreements)

---

## What This Does NOT Change

- Marketplace browse, listing detail, connection request flow — **untouched**
- Remarketing scoring, enrichment, universe management — **untouched**
- Edge functions — **no changes** to existing functions
- RLS policies — **no changes** needed (deals already admin-only, remarketing already admin-only)
- Existing pipeline stages, deal owner assignment, Kanban — **untouched**

The changes are purely **additive**: new columns, new edge function, new UI buttons/links. No existing functionality is removed or modified.

---

## PHASE 2 STATUS: AWAITING APPROVAL

**Recommended approach:** Option B (explicit "Move to Pipeline" button) for the convergence point, rather than automatic trigger. This gives admins control over when a remarketing engagement becomes a formal pipeline deal.

**Next step:** Explicit approval of this architecture before proceeding to Phase 3 implementation.

---

*Document generated during MARKETPLACE ↔ REMARKETING INTEGRATION AUDIT, February 20, 2026.*
