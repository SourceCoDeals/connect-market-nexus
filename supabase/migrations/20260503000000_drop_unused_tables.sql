-- Migration: Drop 31 unused tables identified in codebase audit 2026-03-02
-- These tables have zero references in any frontend code or edge function.
-- Verified: no INSERT, UPDATE, DELETE, or SELECT operations touch these tables.

-- =============================================================================
-- 1. Exact duplicate table
-- =============================================================================
DROP TABLE IF EXISTS marketplace_listings CASCADE;

-- =============================================================================
-- 2. Old Buyer Introduction System (replaced by buyer_contacts)
-- NOTE: buyer_introductions and introduction_status_log are STILL actively used:
--   - src/hooks/use-buyer-introductions.ts
--   - src/components/remarketing/deal-detail/RecommendedBuyersPanel.tsx
--   - src/types/buyer-introductions.ts
--   - src/components/remarketing/deal-detail/BuyerIntroductionsList.tsx
-- DO NOT drop them until those references are migrated.
-- =============================================================================
-- DROP TABLE IF EXISTS buyer_introductions CASCADE;  -- KEPT: still in use
DROP TABLE IF EXISTS buyer_introduction_summary CASCADE;
DROP TABLE IF EXISTS introduced_and_passed_buyers CASCADE;
DROP TABLE IF EXISTS not_yet_introduced_buyers CASCADE;
DROP TABLE IF EXISTS introduction_activity CASCADE;
-- DROP TABLE IF EXISTS introduction_status_log CASCADE;  -- KEPT: still in use

-- =============================================================================
-- 3. Old Contact History System (replaced by contact_activities)
-- =============================================================================
DROP TABLE IF EXISTS contact_call_history CASCADE;
DROP TABLE IF EXISTS contact_email_history CASCADE;
DROP TABLE IF EXISTS contact_linkedin_history CASCADE;
DROP TABLE IF EXISTS contact_history_summary CASCADE;
DROP TABLE IF EXISTS listing_contact_history_summary CASCADE;

-- =============================================================================
-- 4. Replaced / Orphaned Tables
-- =============================================================================
DROP TABLE IF EXISTS ai_command_center_actions CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS connection_request_stages CASCADE;
DROP TABLE IF EXISTS deal_contacts CASCADE;
DROP TABLE IF EXISTS listing_notes CASCADE;
DROP TABLE IF EXISTS permission_audit_log CASCADE;
DROP TABLE IF EXISTS task_pin_log CASCADE;
DROP TABLE IF EXISTS unmapped_primary_owners CASCADE;

-- =============================================================================
-- 5. Computed Views / Metrics (never maintained)
-- =============================================================================
DROP TABLE IF EXISTS data_room_access_status CASCADE;
DROP TABLE IF EXISTS enrichment_success_rate CASCADE;

-- =============================================================================
-- 6. Static Reference Data (logic moved to code)
-- =============================================================================
DROP TABLE IF EXISTS generic_email_domains CASCADE;
DROP TABLE IF EXISTS industry_classifications CASCADE;

-- =============================================================================
-- 7. Unused Queue / Infrastructure
-- =============================================================================
DROP TABLE IF EXISTS linkedin_manual_review_queue CASCADE;

-- =============================================================================
-- 8. Old Scoring System Remnants
-- =============================================================================
DROP TABLE IF EXISTS ranked_deals CASCADE;
DROP TABLE IF EXISTS scoring_runs CASCADE;
DROP TABLE IF EXISTS listings_needing_enrichment CASCADE;
