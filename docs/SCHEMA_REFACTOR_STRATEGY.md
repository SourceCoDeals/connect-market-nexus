# Schema & Architecture Refactor Strategy

This document outlines a phased plan for cleaning up technical debt across the database schema, edge functions, triggers, and frontend data layer. Each phase is independent and can be executed in any order after Phase 0.

---

## Phase 0: Immediate Cleanup (this PR)

**Status: Done**

- Fixed `delete_listing_cascade` — removed reference to dropped `interest_signals` table, added 5 missing FK tables
- Dropped 6 dead columns (listings: `ideal_buyer`, `owner_title`, `project_name_set_at`; deals: `metadata`, `industry_kpis`, `extraction_sources`)
- Dropped 9 orphaned tables (`deal_notes`, `listing_messages`, `chat_recommendations`, `chat_smart_suggestions`, `pe_firm_contacts`, `platform_contacts`, `tracker_activity_logs`, `listing_personal_notes`, `profile_data_snapshots`)
- Dropped 5 orphaned DB functions + 1 trigger + 1 view
- Removed 4 orphaned frontend components/hooks
- Removed 2 dead edge function shared modules

---

## Phase 1: Contact System Migration

**Goal:** Migrate all contact reads to the unified `contacts` table, then sunset the denormalized fields.

### Current State
Contact data lives in 4 places:
1. `profiles` (marketplace users: first_name, last_name, email, phone_number, linkedin_profile)
2. `remarketing_buyer_contacts` (buyer contacts: name, email, phone, role)
3. `listings` (seller contacts: main_contact_name, main_contact_email, etc.)
4. `contacts` (new unified table, backfilled from all 3 above)

Bi-directional sync triggers already exist:
- `trg_sync_seller_contact` — contacts → listings.main_contact_*
- `trg_sync_listing_to_contacts` — listings.main_contact_* → contacts

### Plan
1. **Migrate frontend reads** from `remarketing_buyer_contacts` to `contacts` table
   - `ReMarketingBuyerDetail.tsx` contact section
   - `BuyerDetail.tsx` contact section
   - Any hooks querying `remarketing_buyer_contacts`

2. **Update edge functions** that write to `remarketing_buyer_contacts` to write to `contacts` instead
   - `find-buyer-contacts`
   - `enrich-buyer`
   - `bulk-import-remarketing`

3. **Add sync trigger** for marketplace profile changes → contacts table (so profiles.email changes propagate)

4. **Eventually deprecate** `remarketing_buyer_contacts` (keep as read-only archive, stop writing)

### Risk: Low — additive changes, bi-directional sync already handles consistency

---

## Phase 2: Pipeline Data Denormalization Cleanup

**Goal:** Eliminate redundant data copies between `connection_requests`, `deals`, and `listings`.

### Current State
| Data | Source of Truth | Denormalized Copy | Sync Mechanism |
|------|----------------|-------------------|----------------|
| `buyer_priority_score` | Computed on `connection_requests` | Copied to `deals` | SQL trigger |
| `description` | `listings.description` | `deals.description` (rarely set) | Manual / RPC |
| `stage_entered_at` | `connection_requests.stage_entered_at` | `deals.stage_entered_at` | Trigger |
| `source` | `connection_requests.source` | `deals.source` | `auto_create_deal_from_connection_request` trigger |

### Plan
1. **`buyer_priority_score`**: Move computation directly to `deals` table. Update `update_buyer_priority_score()` trigger to write to `deals` directly. Remove from `connection_requests` after verifying no frontend reads from CR.

2. **`deals.description`**: The `get_deals_with_details()` RPC selects `d.description`. Update the RPC to select `COALESCE(l.description, d.description)` (use listings first), then eventually drop `deals.description`.

3. **Simplify `get_deals_with_details()`**: This 165-line RPC joins 6 tables with subqueries. Refactor to a materialized view that refreshes on deal/stage changes, or split into smaller focused RPCs.

### Risk: Medium — requires coordinated changes to triggers + RPC + frontend

---

## Phase 3: Agreement System Consolidation

**Goal:** Single source of truth for agreement status, resolved through `resolve_contact_agreement_status()`.

### Current State
Agreement status is tracked in 3 places:
1. `firm_agreements` — firm-level NDA/fee agreement status (lifecycle: not_started → sent → signed)
2. `profiles` — individual-level booleans (nda_signed, fee_agreement_signed)
3. `contacts` — individual-level booleans (nda_signed, fee_agreement_signed)

`check_agreement_coverage()` resolves coverage from firm_agreements.
`resolve_contact_agreement_status()` resolves from both firm + individual levels.

### Plan
1. **Migrate all agreement checks** to use `resolve_contact_agreement_status()` instead of reading `profiles.nda_signed` directly

2. **Deprecate profile-level booleans** once all reads go through the RPC:
   - `profiles.nda_signed` → read from contacts/firm_agreements
   - `profiles.fee_agreement_signed` → read from contacts/firm_agreements

3. **Simplify edge functions** that duplicate agreement checking logic:
   - `approve-marketplace-buyer` — has its own NDA check
   - `grant-data-room-access` — has its own fee agreement check
   - Both should call the RPC instead

### Risk: Medium — agreement status is business-critical, needs thorough testing

---

## Phase 4: Edge Function Consolidation

**Goal:** Reduce 115 edge functions to ~60 by merging overlapping ones.

### Candidates for Merging

**Notification functions (8 → 2)**:
```
send-approval-email
send-nda-email / send-nda-reminder / send-fee-agreement-email
send-owner-intro-notification / send-owner-inquiry-notification
send-deal-alert / send-deal-referral
send-notification-email / send-email-notification / send-user-notification
send-contact-response
send-task-notification-email
send-verification-email / send-simple-verification-email / send-verification-success-email
```
→ Merge into `send-transactional-email` (template-based) + `send-notification` (in-app)

**Enrichment functions (6 → 2)**:
```
enrich-buyer / enrich-external-only / process-buyer-enrichment-queue
enrich-deal / enrich-geo-data / process-enrichment-queue
```
→ Merge into `enrich-buyer` (handles all buyer enrichment) + `enrich-deal` (handles all deal enrichment)

**Analysis functions (5 → 1)**:
```
analyze-buyer-notes / analyze-deal-notes / analyze-scoring-patterns
analyze-seller-interest / analyze-tracker-notes
```
→ Merge into `analyze-notes` with a `type` parameter

**Transcript functions (5 → 2)**:
```
extract-buyer-transcript / extract-deal-transcript / extract-transcript
parse-transcript-file / fetch-fireflies-content / sync-fireflies-transcripts
search-fireflies-for-buyer
```
→ Merge into `extract-transcript` + `sync-fireflies`

### Risk: Low per function, high in aggregate — do incrementally

---

## Phase 5: Trigger Chain Simplification

**Goal:** Replace fragile multi-trigger chains with explicit function calls.

### Current Trigger Chains

**Pipeline conversion chain:**
```
connection_requests INSERT
  → ensure_source_from_lead() trigger
  → update_buyer_priority_score() trigger
  → auto_create_deal_from_connection_request() trigger
    → writes to deals table
      → notify_user_on_stage_change() trigger
```
4 triggers fire sequentially on a single INSERT. If any fails, the whole chain rolls back with an opaque error.

**Agreement propagation chain:**
```
firm_agreements UPDATE
  → log_agreement_status_change() trigger
  → sync_fee_agreement_to_remarketing() trigger
    → writes to remarketing_buyers
```

### Plan
1. **Replace trigger chains with explicit RPC calls** — instead of 4 triggers on connection_requests, create `create_pipeline_deal(p_connection_request_id)` RPC that does all the work in a single function with proper error handling.

2. **Keep simple triggers** — `updated_at` timestamp triggers, `update_buyer_priority_score` are fine as triggers. The problem is chains of triggers that modify other tables.

3. **Add error logging** — triggers that fail silently are dangerous. Add `RAISE WARNING` or log to `cron_job_logs` on failure.

### Duplicate Trigger Inventory (from audit)

These triggers have 2-8 versions across migrations — only the latest is active but the history creates confusion:

| Trigger | Versions | Tables | Issue |
|---------|----------|--------|-------|
| `set_chat_conversations_updated_at` | 8 | chat_conversations | Recreated across 4 chatbot migration attempts |
| `auto_enrich_new_listing` / `auto_enrich_updated_listing` | 5+4 | listings | May cause duplicate enrichment jobs |
| `auto_create_deal_from_connection_request` | 4 | connection_requests | 2 different function names for same logic |
| `sync_connection_request_firm_trigger` | 4 | connection_requests | Rapid iteration on Oct 27 |
| `auto_generate_deal_identifier` | 3 | deals | 2 different trigger names |
| `update_deal_priority_trigger` | 2 | deals | Created hours apart |

### Dead Functions Inventory (from audit)

| Function | Status | Notes |
|----------|--------|-------|
| `test_admin_status()` | **Dropped in Phase 0** | Debug diagnostic |
| `debug_fee_agreement_update()` | **Dropped in Phase 0** | Debug diagnostic |
| `validate_analytics_schema()` | **Dropped in Phase 0** | One-time migration validator |
| `refresh_analytics_views()` | **Stub — no-op** | Called by performance-monitor.ts but does nothing |
| `delete_user_completely()` | Active (7 versions) | Only latest is active; consolidate |
| `get_marketplace_analytics()` | Likely dead | Superseded by `get_simple_marketplace_analytics()` |

### Risk: Medium — need to identify all trigger execution paths first

---

## Phase 6: Frontend Data Layer Cleanup

**Goal:** Simplify the data fetching layer and remove dead code.

### Current Issues

1. **`use-deals.ts` is 557 lines** — does post-processing that should be in the DB (sorting, filtering, mapping buyer types). Refactor to use a view or simpler RPC.

2. **Inconsistent data fetching** — some hooks use `.from().select()`, others use `.rpc()`, others use custom queries. Standardize on a pattern.

3. **Dead type exports** — types.ts has definitions for 9 dropped tables. Regenerate after migration.

4. **Duplicate hooks** — `use-marketplace-analytics.ts` and `use-simple-marketplace-analytics.ts` both call the same RPC.

### Plan
1. **Regenerate types** after migrations run
2. **Consolidate duplicate hooks** (marketplace analytics)
3. **Move post-processing to DB** — deal sorting, buyer type mapping, priority calculations
4. **Remove dead imports** — audit all import statements for references to deleted files

### Risk: Low — frontend changes are easily testable

---

## Appendix: Data Redundancy Inventory (from audit)

Key data duplication patterns that create sync/staleness risks:

| Data | Source of Truth | Copies | Sync Mechanism | Risk |
|------|----------------|--------|----------------|------|
| Company name | `profiles.company` | `profiles.company_name`, `remarketing_buyers.company_name` | Approval trigger + AI extraction | 3 fields, 2 write paths, no cascade |
| Buyer type | `profiles.buyer_type` | `remarketing_buyers.buyer_type` (mapped enum) | Approval trigger + AI extraction | Type mapping in 2 places |
| Thesis / description | `profiles.ideal_target_description` | `remarketing_buyers.thesis_summary`, `profiles.mandate_blurb` (fallback) | Approval trigger + AI extraction | COALESCE picks first non-null; no edit history |
| Revenue targets | `profiles.target_deal_size_min/max` | `remarketing_buyers.target_revenue_min/max` | Approval trigger + AI extraction | Diverges when AI overwrites |
| Buyer priority | Computed from `profiles.buyer_type` | `connection_requests.buyer_priority_score` → `deals.buyer_priority_score` | 2 SQL triggers | Stale if profile updated outside trigger path |
| Deal description | `listings.description` | `deals.description`, `listings.description_html` (computed), `listings.description_json` (rich text) | Trigger for HTML; manual for deals | `deals.description` rarely set |

These should be addressed incrementally during Phases 1-3.

---

## Priority Order

| Phase | Effort | Impact | Risk | Recommended Order |
|-------|--------|--------|------|-------------------|
| Phase 0 | Small | High (fixes bugs) | Zero | **Now** |
| Phase 1 | Medium | Medium (data consistency) | Low | Next sprint |
| Phase 6 | Small | Medium (DX improvement) | Low | Next sprint |
| Phase 2 | Medium | Medium (simplification) | Medium | Following sprint |
| Phase 4 | Large | High (maintenance reduction) | Low per fn | Ongoing |
| Phase 3 | Medium | High (correctness) | Medium | After Phase 1 |
| Phase 5 | Large | High (reliability) | Medium | After Phase 2 |
