-- ============================================================================
-- MIGRATION: Drop 8 pairs of duplicate indexes flagged by supabase advisors
-- ============================================================================
-- Each listed pair has identical columns + WHERE clause. We keep the member
-- that matches the column it covers (`_<column_name>` naming) and drop the
-- shorter/older alias. Zero semantic change — only removes redundant index
-- maintenance cost.
--
-- Before/after confirmed by
--   supabase db advisors --linked | grep "Duplicate Index"
-- which flagged 8 pairs on 2026-04-20. This migration drops one of each.
-- ============================================================================

-- _deprecated_remarketing_buyer_contacts(buyer_id)
DROP INDEX IF EXISTS public.idx_remarketing_contacts_buyer;

-- buyer_transcripts(buyer_id)
DROP INDEX IF EXISTS public.idx_buyer_transcripts_buyer;

-- contact_activities(activity_type)
DROP INDEX IF EXISTS public.idx_ca_type;

-- contact_activities(contact_id)
DROP INDEX IF EXISTS public.idx_ca_contact_id;

-- email_messages(contact_id)
DROP INDEX IF EXISTS public.idx_email_messages_contact;

-- heyreach_messages(remarketing_buyer_id) WHERE remarketing_buyer_id IS NOT NULL
-- `_firm` is a misnomer — the index is actually on remarketing_buyer_id. Drop it.
DROP INDEX IF EXISTS public.idx_heyreach_messages_firm;

-- listings(referral_partner_id)
DROP INDEX IF EXISTS public.idx_listings_referral_partner;

-- remarketing_scores(buyer_id)
DROP INDEX IF EXISTS public.idx_remarketing_scores_buyer;
