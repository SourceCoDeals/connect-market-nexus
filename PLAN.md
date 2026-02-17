# Schema Cleanup Plan — Zero Functionality Loss

## Phase 1: Drop Dead Columns (20 listings) ✅ DONE

These have ZERO code references outside types.ts and migrations. Dropping them changes nothing.

### Migration: `20260217130000_drop_dead_columns.sql`

**Listings table — 20 confirmed dead columns:**
- `ai_description` — never read or written
- `estimated_ebitda` — never read or written
- `lead_source_notes` — never read or written
- `is_owner_dependent` — never read or written
- `has_multiple_locations` — never read or written
- `product_revenue_percentage` — never read or written
- `service_revenue_percentage` — never read or written
- `recurring_revenue_percentage` — never read or written
- `project_revenue_percentage` — never read or written
- `calculated_rank` — never read or written
- `final_rank` — never read or written
- `rank_locked` — never read or written
- `last_ranked_at` — never read or written
- `enrichment_scheduled_at` — never read or written
- `enrichment_last_attempted_at` — never read or written
- `enrichment_refresh_due_at` — never read or written
- `enrichment_last_successful_at` — never read or written
- `enrichment_error_message` — never read or written
- `deal_industry_score` — never read or written
- `deal_motivation_score` — never read or written

**Corrected from original plan:** The following were incorrectly flagged as dead:
- `revenue_metric_subtitle` — actually used in 8+ files (editors, ListingDetail)
- `ebitda_metric_subtitle` — actually used in 8+ files (same pattern)
- `revenue_source_quote` — used in deal detail + extraction edge functions
- `ebitda_source_quote` — used in deal detail + extraction edge functions
- `contact_company` (deals) — used in 13+ files (CreateDealModal, pipeline views, etc.)
- `contact_phone` (deals) — used in 15+ files (deals, referrals, buyer detail, etc.)
- `contact_role` (deals) — used in 9+ files (kanban cards, pipeline detail, etc.)

**Code changes:** None needed — no code references these 20 columns.

---

## Phase 2: Remove Write-Only Columns (4 columns + code cleanup)

These are written by enrichment/extraction but never displayed or read by anything useful.

### Columns to drop:
- `headquarters_address` — extracted by LLM but immediately mapped to `address`; remove from extraction code
- `has_management_team` — LLM extraction target, never displayed; remove from extraction prompt
- `mr_notes` — passed to one analyzer, never displayed; remove from analyzer
- `revenue_trend` — nearly dead (3 refs); remove from extraction

### Code changes needed:
1. `supabase/functions/_shared/deal-extraction.ts` — remove from whitelist
2. `supabase/functions/extract-deal-transcript/index.ts` — remove from extraction interface/prompt
3. `supabase/functions/analyze-deal-notes/index.ts` — remove `has_management_team` reference
4. `supabase/functions/analyze-seller-interest/index.ts` — remove `mr_notes` reference

---

## Phase 3: Consolidate Enrichment Timestamps (listings table only) ✅ DONE

`enriched_at` (primary) + `last_enriched_at` (redundant) on the **listings** table.

### Action taken:
- Merged `last_enriched_at` data into `enriched_at` where `enriched_at` is null
- Removed `last_enriched_at` write from `enrich-deal/index.ts`
- Updated `useAutoEnrichment.ts` to use `enriched_at` only
- Dropped `last_enriched_at` from listings table

### NOT changed (correctly kept):
- `enrichment_status` — actively used in ReMarketingDashboard for pending/failed/enriched categorization
- `last_enriched_at` on the **deals** table — that table has no `enriched_at` column; ma-intelligence pages depend on it

### Files updated:
- `supabase/functions/enrich-deal/index.ts` — removed redundant `last_enriched_at` write
- `src/hooks/useAutoEnrichment.ts` — simplified to use `enriched_at` only

---

## Summary

| Phase | Columns Dropped | Code Changes | Risk |
|-------|----------------|--------------|------|
| 1 | 20 (listings) | 0 files | Zero — no code uses them |
| 2 | 4 (listings) | 4 files (edge functions + UI) | Very low — removing write-only fields |
| 3 | 1 (listings) | 2 files | Zero — redundant timestamp |
| **Total** | **25** | **6 files** | |
