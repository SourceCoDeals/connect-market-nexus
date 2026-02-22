-- ============================================================================
-- SCHEMA CLEANUP: Drop verified-dead columns and orphaned tables
-- ============================================================================

-- PART 1: Drop 4 dead columns
ALTER TABLE public.listings DROP COLUMN IF EXISTS ideal_buyer;
ALTER TABLE public.listings DROP COLUMN IF EXISTS owner_title;
ALTER TABLE public.listings DROP COLUMN IF EXISTS project_name_set_at;
ALTER TABLE public.deals DROP COLUMN IF EXISTS metadata;

-- PART 2: Drop 2 display-only columns from deals
ALTER TABLE public.deals DROP COLUMN IF EXISTS industry_kpis;
ALTER TABLE public.deals DROP COLUMN IF EXISTS extraction_sources;

-- PART 3: Drop 9 orphaned tables
DROP TABLE IF EXISTS public.deal_notes CASCADE;
DROP TABLE IF EXISTS public.listing_messages CASCADE;
DROP TABLE IF EXISTS public.chat_recommendations CASCADE;
DROP TABLE IF EXISTS public.chat_smart_suggestions CASCADE;
DROP TABLE IF EXISTS public.pe_firm_contacts CASCADE;
DROP TABLE IF EXISTS public.platform_contacts CASCADE;
DROP TABLE IF EXISTS public.tracker_activity_logs CASCADE;
DROP TABLE IF EXISTS public.listing_personal_notes CASCADE;

-- PART 4: Drop profile_data_snapshots and its entire dependency tree
DROP TRIGGER IF EXISTS on_profile_created_capture_snapshot ON public.profiles;
DROP FUNCTION IF EXISTS public.capture_signup_snapshot();
DROP FUNCTION IF EXISTS public.get_latest_profile_snapshot(UUID);
DROP FUNCTION IF EXISTS public.preview_profile_data_restoration();
DROP FUNCTION IF EXISTS public.restore_profile_data_automated();
DROP FUNCTION IF EXISTS public.get_profiles_with_history();
DROP VIEW IF EXISTS public.profiles_with_history;
DROP TABLE IF EXISTS public.profile_data_snapshots CASCADE;

-- PART 5: Drop dead/debug database functions
DROP FUNCTION IF EXISTS public.test_admin_status();
DROP FUNCTION IF EXISTS public.debug_fee_agreement_update(uuid, boolean);
DROP FUNCTION IF EXISTS public.validate_analytics_schema();