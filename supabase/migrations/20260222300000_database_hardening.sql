-- =============================================
-- Database Hardening Migration
-- 1. Add RLS to tables missing it
-- 2. Add ON DELETE to critical foreign keys
-- 3. Add missing indexes for performance
-- =============================================

-- ============================================
-- 1. RLS for tables that don't have it yet
-- ============================================

-- enrichment_queue: admin-only
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enrichment_queue') THEN
    ALTER TABLE public.enrichment_queue ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admins can manage enrichment queue" ON public.enrichment_queue;
    CREATE POLICY "Admins can manage enrichment queue"
      ON public.enrichment_queue FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ============================================
-- 2. Add ON DELETE to critical foreign keys
-- ============================================

-- Helper: safely drop and recreate FK constraints with ON DELETE
-- Pattern: DROP old constraint, ADD new with ON DELETE

-- connection_messages.sender_id → profiles (SET NULL to preserve message history)
ALTER TABLE public.connection_messages
  DROP CONSTRAINT IF EXISTS connection_messages_sender_id_fkey,
  ADD CONSTRAINT connection_messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Make sender_id nullable first (needed for SET NULL)
ALTER TABLE public.connection_messages
  ALTER COLUMN sender_id DROP NOT NULL;

-- inbound_leads.mapped_by → profiles (SET NULL)
ALTER TABLE public.inbound_leads
  DROP CONSTRAINT IF EXISTS inbound_leads_mapped_by_fkey,
  ADD CONSTRAINT inbound_leads_mapped_by_fkey
    FOREIGN KEY (mapped_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- inbound_leads.converted_by → profiles (SET NULL)
ALTER TABLE public.inbound_leads
  DROP CONSTRAINT IF EXISTS inbound_leads_converted_by_fkey,
  ADD CONSTRAINT inbound_leads_converted_by_fkey
    FOREIGN KEY (converted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- connection_requests.converted_by → profiles (SET NULL)
ALTER TABLE public.connection_requests
  DROP CONSTRAINT IF EXISTS connection_requests_converted_by_fkey,
  ADD CONSTRAINT connection_requests_converted_by_fkey
    FOREIGN KEY (converted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- inbound_leads.converted_to_request_id → connection_requests (SET NULL)
ALTER TABLE public.inbound_leads
  DROP CONSTRAINT IF EXISTS inbound_leads_converted_to_request_id_fkey,
  ADD CONSTRAINT inbound_leads_converted_to_request_id_fkey
    FOREIGN KEY (converted_to_request_id) REFERENCES public.connection_requests(id) ON DELETE SET NULL;

-- inbound_leads.mapped_to_listing_id → listings (SET NULL)
ALTER TABLE public.inbound_leads
  DROP CONSTRAINT IF EXISTS inbound_leads_mapped_to_listing_id_fkey,
  ADD CONSTRAINT inbound_leads_mapped_to_listing_id_fkey
    FOREIGN KEY (mapped_to_listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

-- deal_activities.deal_id → deals (CASCADE - activities belong to deal)
ALTER TABLE public.deal_activities
  DROP CONSTRAINT IF EXISTS deal_activities_deal_id_fkey,
  ADD CONSTRAINT deal_activities_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- deal_comments.deal_id → deals (CASCADE - comments belong to deal)
ALTER TABLE public.deal_comments
  DROP CONSTRAINT IF EXISTS deal_comments_deal_id_fkey,
  ADD CONSTRAINT deal_comments_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- deal_contacts.deal_id → deals (CASCADE - contacts belong to deal)
ALTER TABLE public.deal_contacts
  DROP CONSTRAINT IF EXISTS deal_contacts_deal_id_fkey,
  ADD CONSTRAINT deal_contacts_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- deal_notes.deal_id → deals (CASCADE - notes belong to deal)
ALTER TABLE public.deal_notes
  DROP CONSTRAINT IF EXISTS deal_notes_deal_id_fkey,
  ADD CONSTRAINT deal_notes_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- deal_tasks.deal_id → deals (CASCADE - tasks belong to deal)
ALTER TABLE public.deal_tasks
  DROP CONSTRAINT IF EXISTS deal_tasks_deal_id_fkey,
  ADD CONSTRAINT deal_tasks_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- deal_task_reviewers.task_id → deal_tasks (CASCADE)
ALTER TABLE public.deal_task_reviewers
  DROP CONSTRAINT IF EXISTS deal_task_reviewers_task_id_fkey,
  ADD CONSTRAINT deal_task_reviewers_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.deal_tasks(id) ON DELETE CASCADE;

-- deal_documents.deal_id → deals (CASCADE - docs belong to deal)
ALTER TABLE public.deal_documents
  DROP CONSTRAINT IF EXISTS deal_documents_deal_id_fkey,
  ADD CONSTRAINT deal_documents_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- deal_transcripts.deal_id → deals (CASCADE)
ALTER TABLE public.deal_transcripts
  DROP CONSTRAINT IF EXISTS deal_transcripts_deal_id_fkey,
  ADD CONSTRAINT deal_transcripts_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- deal_referrals.deal_id → deals (CASCADE)
ALTER TABLE public.deal_referrals
  DROP CONSTRAINT IF EXISTS deal_referrals_deal_id_fkey,
  ADD CONSTRAINT deal_referrals_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- deal_scoring_adjustments.deal_id → deals (CASCADE)
ALTER TABLE public.deal_scoring_adjustments
  DROP CONSTRAINT IF EXISTS deal_scoring_adjustments_deal_id_fkey,
  ADD CONSTRAINT deal_scoring_adjustments_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- deal_alerts.deal_id → deals (CASCADE)
ALTER TABLE public.deal_alerts
  DROP CONSTRAINT IF EXISTS deal_alerts_deal_id_fkey,
  ADD CONSTRAINT deal_alerts_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- remarketing_scores.buyer_id → remarketing_buyers (CASCADE)
ALTER TABLE public.remarketing_scores
  DROP CONSTRAINT IF EXISTS remarketing_scores_buyer_id_fkey,
  ADD CONSTRAINT remarketing_scores_buyer_id_fkey
    FOREIGN KEY (buyer_id) REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE;

-- remarketing_buyer_contacts.buyer_id → remarketing_buyers (CASCADE)
ALTER TABLE public.remarketing_buyer_contacts
  DROP CONSTRAINT IF EXISTS remarketing_buyer_contacts_buyer_id_fkey,
  ADD CONSTRAINT remarketing_buyer_contacts_buyer_id_fkey
    FOREIGN KEY (buyer_id) REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE;

-- firm_members.buyer_id → remarketing_buyers (CASCADE)
ALTER TABLE public.firm_members
  DROP CONSTRAINT IF EXISTS firm_members_buyer_id_fkey,
  ADD CONSTRAINT firm_members_buyer_id_fkey
    FOREIGN KEY (buyer_id) REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE;

-- pe_firm_contacts.buyer_id → remarketing_buyers (CASCADE)
ALTER TABLE public.pe_firm_contacts
  DROP CONSTRAINT IF EXISTS pe_firm_contacts_buyer_id_fkey,
  ADD CONSTRAINT pe_firm_contacts_buyer_id_fkey
    FOREIGN KEY (buyer_id) REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE;

-- ============================================
-- 3. Missing indexes for performance
-- ============================================

-- deal_activities: index on deal_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_id
  ON public.deal_activities(deal_id);

-- deal_comments: index on deal_id
CREATE INDEX IF NOT EXISTS idx_deal_comments_deal_id
  ON public.deal_comments(deal_id);

-- deal_contacts: index on deal_id
CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal_id
  ON public.deal_contacts(deal_id);

-- deal_notes: index on deal_id
CREATE INDEX IF NOT EXISTS idx_deal_notes_deal_id
  ON public.deal_notes(deal_id);

-- deal_tasks: index on deal_id
CREATE INDEX IF NOT EXISTS idx_deal_tasks_deal_id
  ON public.deal_tasks(deal_id);

-- deal_documents: index on deal_id
CREATE INDEX IF NOT EXISTS idx_deal_documents_deal_id
  ON public.deal_documents(deal_id);

-- deal_transcripts: index on deal_id
CREATE INDEX IF NOT EXISTS idx_deal_transcripts_deal_id
  ON public.deal_transcripts(deal_id);

-- deal_referrals: index on deal_id
CREATE INDEX IF NOT EXISTS idx_deal_referrals_deal_id
  ON public.deal_referrals(deal_id);

-- inbound_leads: index on mapped_to_listing_id for lookups
CREATE INDEX IF NOT EXISTS idx_inbound_leads_listing
  ON public.inbound_leads(mapped_to_listing_id)
  WHERE mapped_to_listing_id IS NOT NULL;

-- remarketing_scores: index on buyer_id for lookups
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_buyer_id
  ON public.remarketing_scores(buyer_id);

-- remarketing_buyer_contacts: index on buyer_id
CREATE INDEX IF NOT EXISTS idx_remarketing_buyer_contacts_buyer
  ON public.remarketing_buyer_contacts(buyer_id);

-- firm_members: index on buyer_id
CREATE INDEX IF NOT EXISTS idx_firm_members_buyer_id
  ON public.firm_members(buyer_id);

-- pe_firm_contacts: index on buyer_id
CREATE INDEX IF NOT EXISTS idx_pe_firm_contacts_buyer_id
  ON public.pe_firm_contacts(buyer_id);

-- user_sessions: index on user_id for session lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON public.user_sessions(user_id);

-- page_views: index on session_id for session drill-down
CREATE INDEX IF NOT EXISTS idx_page_views_session_id
  ON public.page_views(session_id);

-- user_events: index on session_id
CREATE INDEX IF NOT EXISTS idx_user_events_session_id
  ON public.user_events(session_id);

-- listing_analytics: index on listing_id
CREATE INDEX IF NOT EXISTS idx_listing_analytics_listing_id
  ON public.listing_analytics(listing_id);
