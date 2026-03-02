-- Migration: Drop unused tables and views identified in codebase audit 2026-03-02
-- These objects have zero references in any frontend code or edge function.
-- Verified: no INSERT, UPDATE, DELETE, or SELECT operations touch these.

-- =============================================================================
-- 1. Views (must be dropped before tables they may depend on)
-- =============================================================================
DROP VIEW IF EXISTS marketplace_listings CASCADE;
DROP VIEW IF EXISTS buyer_introduction_summary CASCADE;
DROP VIEW IF EXISTS introduced_and_passed_buyers CASCADE;
DROP VIEW IF EXISTS not_yet_introduced_buyers CASCADE;
DROP VIEW IF EXISTS contact_history_summary CASCADE;
DROP VIEW IF EXISTS listing_contact_history_summary CASCADE;
DROP VIEW IF EXISTS enrichment_success_rate CASCADE;
DROP VIEW IF EXISTS unmapped_primary_owners CASCADE;
DROP VIEW IF EXISTS data_room_access_status CASCADE;
DROP VIEW IF EXISTS linkedin_manual_review_queue CASCADE;
DROP VIEW IF EXISTS ranked_deals CASCADE;
DROP VIEW IF EXISTS listings_needing_enrichment CASCADE;

-- =============================================================================
-- 2. Old Buyer Introduction System (replaced by buyer_contacts)
-- =============================================================================
DROP TABLE IF EXISTS buyer_introductions CASCADE;
DROP TABLE IF EXISTS introduction_activity CASCADE;
DROP TABLE IF EXISTS introduction_status_log CASCADE;

-- =============================================================================
-- 3. Old Contact History System (replaced by contact_activities)
-- =============================================================================
DROP TABLE IF EXISTS contact_call_history CASCADE;
DROP TABLE IF EXISTS contact_email_history CASCADE;
DROP TABLE IF EXISTS contact_linkedin_history CASCADE;

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

-- =============================================================================
-- 5. Static Reference Data (logic moved to code)
-- =============================================================================
DROP TABLE IF EXISTS generic_email_domains CASCADE;
DROP TABLE IF EXISTS industry_classifications CASCADE;

-- =============================================================================
-- 6. Old Scoring System Remnants
-- =============================================================================
DROP TABLE IF EXISTS scoring_runs CASCADE;
