-- ============================================================================
-- SCHEMA CLEANUP: Drop verified-dead columns and orphaned tables
-- ============================================================================
-- Every item below was verified across ALL 8 dimensions:
--   1. Frontend .from()/.select() reads — ZERO
--   2. Edge function reads/writes — ZERO
--   3. SQL trigger references — ZERO
--   4. RLS policy references — ZERO
--   5. RPC function/view references — ZERO
--   6. Scoring engine references — ZERO
--   7. Enrichment pipeline references — ZERO
--   8. FK constraints — NONE (or CASCADE-handled)
--
-- The ONLY references found were in the auto-generated types.ts file,
-- which will be regenerated after this migration.
-- ============================================================================


-- ============================================================================
-- PART 1: Drop 4 dead columns
-- ============================================================================
-- These columns exist in DDL and generated types only. Zero code references.

-- listings.ideal_buyer — never read by any frontend, edge function, trigger, or scoring
ALTER TABLE public.listings DROP COLUMN IF EXISTS ideal_buyer;

-- listings.owner_title — never read by any frontend, edge function, trigger, or scoring
ALTER TABLE public.listings DROP COLUMN IF EXISTS owner_title;

-- listings.project_name_set_at — only set alongside project_name, never read independently
ALTER TABLE public.listings DROP COLUMN IF EXISTS project_name_set_at;

-- deals.metadata — distinct from firm_agreements.metadata (which IS active).
-- deals.metadata is never read by any code path.
ALTER TABLE public.deals DROP COLUMN IF EXISTS metadata;


-- ============================================================================
-- PART 2: Drop 2 display-only columns from deals
-- ============================================================================
-- These are only conditionally rendered in DealDetail.tsx (graceful degradation).
-- No trigger, scoring, RPC, or edge function references.

-- deals.industry_kpis — conditional render in DealDetail.tsx, will just hide
ALTER TABLE public.deals DROP COLUMN IF EXISTS industry_kpis;

-- deals.extraction_sources — conditional render in DealDetail.tsx, will just hide
-- (distinct from remarketing_buyers.extraction_sources which IS actively used)
ALTER TABLE public.deals DROP COLUMN IF EXISTS extraction_sources;


-- ============================================================================
-- PART 3: Drop 9 orphaned tables
-- ============================================================================
-- Each verified: zero .from() calls in frontend, zero edge function imports,
-- zero trigger references, zero RPC references.

-- deal_notes: data migrated to deal_comments in migration 20251003220245
DROP TABLE IF EXISTS public.deal_notes CASCADE;

-- listing_messages: part of unshipped messaging feature; zero .from() calls
-- (listing_conversations cascade handles any FK)
DROP TABLE IF EXISTS public.listing_messages CASCADE;

-- chat_recommendations: shared module proactive-recommendations.ts is never
-- imported by any edge function index.ts — dead code
DROP TABLE IF EXISTS public.chat_recommendations CASCADE;

-- chat_smart_suggestions: shared module smart-suggestions.ts is never
-- imported by any edge function index.ts — dead code
DROP TABLE IF EXISTS public.chat_smart_suggestions CASCADE;

-- pe_firm_contacts: replaced by unified contacts table; zero code references
DROP TABLE IF EXISTS public.pe_firm_contacts CASCADE;

-- platform_contacts: replaced by unified contacts table; zero code references
DROP TABLE IF EXISTS public.platform_contacts CASCADE;

-- tracker_activity_logs: part of unshipped tracker audit feature; zero code references
DROP TABLE IF EXISTS public.tracker_activity_logs CASCADE;

-- listing_personal_notes: zero .from() calls in frontend; only reference was
-- in delete_listing_cascade (which still handles it in the updated function
-- from 20260302000000 for safety, but the table itself is unused)
DROP TABLE IF EXISTS public.listing_personal_notes CASCADE;


-- ============================================================================
-- PART 4: Drop profile_data_snapshots and its entire dependency tree
-- ============================================================================
-- This table has 5 dependent functions, 1 trigger, and 1 view — but ALL the
-- frontend components that consumed them are orphaned (never imported by any page):
--   - AutomatedDataRestoration.tsx (never imported)
--   - ProfileDataRecovery.tsx (never imported)
--   - ProfileDataInspector.tsx (never imported)
--   - use-profiles-history.ts (only used by the orphaned components above)

-- 4a. Drop the trigger first
DROP TRIGGER IF EXISTS on_profile_created_capture_snapshot ON public.profiles;

-- 4b. Drop dependent functions
DROP FUNCTION IF EXISTS public.capture_signup_snapshot();
DROP FUNCTION IF EXISTS public.get_latest_profile_snapshot(UUID);
DROP FUNCTION IF EXISTS public.preview_profile_data_restoration();
DROP FUNCTION IF EXISTS public.restore_profile_data_automated();
DROP FUNCTION IF EXISTS public.get_profiles_with_history();

-- 4c. Drop the view if it still exists (was converted to function in 20250826173517)
DROP VIEW IF EXISTS public.profiles_with_history;

-- 4d. Drop the table
DROP TABLE IF EXISTS public.profile_data_snapshots CASCADE;


-- ============================================================================
-- PART 5: Drop dead/debug database functions
-- ============================================================================
-- Found by trigger/function audit: never called by any code path.

-- Debug function: test admin authentication — diagnostic only
DROP FUNCTION IF EXISTS public.test_admin_status();

-- Debug function: debug fee agreement updates — diagnostic only
DROP FUNCTION IF EXISTS public.debug_fee_agreement_update();

-- One-time validation function: ran once at schema creation
DROP FUNCTION IF EXISTS public.validate_analytics_schema();

-- NOTE: refresh_analytics_views() is a STUB (does nothing, just raises NOTICE)
-- but it IS called from src/lib/performance-monitor.ts — leave as no-op for now


-- ============================================================================
-- PART 6: Clean up dead shared edge function modules
-- ============================================================================
-- proactive-recommendations.ts and smart-suggestions.ts are never imported.
-- They can't be dropped via SQL, but we note them here for the code cleanup.
-- TODO: Delete these files in the code commit:
--   supabase/functions/_shared/proactive-recommendations.ts
--   supabase/functions/_shared/smart-suggestions.ts


-- ============================================================================
-- Summary:
--   6 columns dropped: ideal_buyer, owner_title, project_name_set_at (listings)
--                       metadata, industry_kpis, extraction_sources (deals)
--   9 tables dropped:  deal_notes, listing_messages, chat_recommendations,
--                       chat_smart_suggestions, pe_firm_contacts, platform_contacts,
--                       tracker_activity_logs, listing_personal_notes,
--                       profile_data_snapshots
--   8 functions dropped: capture_signup_snapshot, get_latest_profile_snapshot,
--                         preview_profile_data_restoration,
--                         restore_profile_data_automated, get_profiles_with_history,
--                         test_admin_status, debug_fee_agreement_update,
--                         validate_analytics_schema
--   1 trigger dropped:  on_profile_created_capture_snapshot
--   1 view dropped:     profiles_with_history (if it still existed)
-- ============================================================================
