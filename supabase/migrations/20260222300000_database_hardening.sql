-- =============================================
-- Database Hardening Migration
-- 1. Add RLS to tables missing it
-- 2. Add ON DELETE to critical foreign keys
-- 3. Add missing indexes for performance
--
-- All operations guarded with IF EXISTS checks
-- so missing tables are safely skipped.
-- =============================================

DO $$ BEGIN

-- ============================================
-- 1. RLS for tables that don't have it yet
-- ============================================

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enrichment_queue') THEN
  ALTER TABLE public.enrichment_queue ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Admins can manage enrichment queue" ON public.enrichment_queue;
  CREATE POLICY "Admins can manage enrichment queue"
    ON public.enrichment_queue FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
END IF;

-- ============================================
-- 2. Add ON DELETE to critical foreign keys
-- ============================================

-- connection_messages.sender_id → profiles (SET NULL)
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'connection_messages') THEN
  ALTER TABLE public.connection_messages
    DROP CONSTRAINT IF EXISTS connection_messages_sender_id_fkey,
    ADD CONSTRAINT connection_messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  ALTER TABLE public.connection_messages
    ALTER COLUMN sender_id DROP NOT NULL;
END IF;

-- inbound_leads FKs
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inbound_leads') THEN
  ALTER TABLE public.inbound_leads
    DROP CONSTRAINT IF EXISTS inbound_leads_mapped_by_fkey,
    ADD CONSTRAINT inbound_leads_mapped_by_fkey
      FOREIGN KEY (mapped_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  ALTER TABLE public.inbound_leads
    DROP CONSTRAINT IF EXISTS inbound_leads_converted_by_fkey,
    ADD CONSTRAINT inbound_leads_converted_by_fkey
      FOREIGN KEY (converted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  ALTER TABLE public.inbound_leads
    DROP CONSTRAINT IF EXISTS inbound_leads_converted_to_request_id_fkey,
    ADD CONSTRAINT inbound_leads_converted_to_request_id_fkey
      FOREIGN KEY (converted_to_request_id) REFERENCES public.connection_requests(id) ON DELETE SET NULL;

  ALTER TABLE public.inbound_leads
    DROP CONSTRAINT IF EXISTS inbound_leads_mapped_to_listing_id_fkey,
    ADD CONSTRAINT inbound_leads_mapped_to_listing_id_fkey
      FOREIGN KEY (mapped_to_listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;
END IF;

-- connection_requests.converted_by → profiles (SET NULL)
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'connection_requests') THEN
  ALTER TABLE public.connection_requests
    DROP CONSTRAINT IF EXISTS connection_requests_converted_by_fkey,
    ADD CONSTRAINT connection_requests_converted_by_fkey
      FOREIGN KEY (converted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
END IF;

-- deal child tables → deals (CASCADE)
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_activities') THEN
  DELETE FROM public.deal_activities WHERE deal_id NOT IN (SELECT id FROM public.deals);
  ALTER TABLE public.deal_activities
    DROP CONSTRAINT IF EXISTS deal_activities_deal_id_fkey,
    ADD CONSTRAINT deal_activities_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_comments') THEN
  DELETE FROM public.deal_comments WHERE deal_id NOT IN (SELECT id FROM public.deals);
  ALTER TABLE public.deal_comments
    DROP CONSTRAINT IF EXISTS deal_comments_deal_id_fkey,
    ADD CONSTRAINT deal_comments_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_contacts') THEN
  DELETE FROM public.deal_contacts WHERE deal_id NOT IN (SELECT id FROM public.deals);
  ALTER TABLE public.deal_contacts
    DROP CONSTRAINT IF EXISTS deal_contacts_deal_id_fkey,
    ADD CONSTRAINT deal_contacts_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_notes') THEN
  DELETE FROM public.deal_notes WHERE deal_id NOT IN (SELECT id FROM public.deals);
  ALTER TABLE public.deal_notes
    DROP CONSTRAINT IF EXISTS deal_notes_deal_id_fkey,
    ADD CONSTRAINT deal_notes_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_tasks') THEN
  DELETE FROM public.deal_tasks WHERE deal_id NOT IN (SELECT id FROM public.deals);
  ALTER TABLE public.deal_tasks
    DROP CONSTRAINT IF EXISTS deal_tasks_deal_id_fkey,
    ADD CONSTRAINT deal_tasks_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_task_reviewers') THEN
  ALTER TABLE public.deal_task_reviewers
    DROP CONSTRAINT IF EXISTS deal_task_reviewers_task_id_fkey,
    ADD CONSTRAINT deal_task_reviewers_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES public.deal_tasks(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_documents') THEN
  DELETE FROM public.deal_documents WHERE deal_id NOT IN (SELECT id FROM public.deals);
  ALTER TABLE public.deal_documents
    DROP CONSTRAINT IF EXISTS deal_documents_deal_id_fkey,
    ADD CONSTRAINT deal_documents_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
END IF;

IF EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'deal_transcripts' AND column_name = 'deal_id'
) THEN
  DELETE FROM public.deal_transcripts WHERE deal_id NOT IN (SELECT id FROM public.deals);
  ALTER TABLE public.deal_transcripts
    DROP CONSTRAINT IF EXISTS deal_transcripts_deal_id_fkey,
    ADD CONSTRAINT deal_transcripts_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_referrals') THEN
  DELETE FROM public.deal_referrals WHERE deal_id NOT IN (SELECT id FROM public.deals);
  ALTER TABLE public.deal_referrals
    DROP CONSTRAINT IF EXISTS deal_referrals_deal_id_fkey,
    ADD CONSTRAINT deal_referrals_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_scoring_adjustments') THEN
  DELETE FROM public.deal_scoring_adjustments WHERE deal_id NOT IN (SELECT id FROM public.deals);
  ALTER TABLE public.deal_scoring_adjustments
    DROP CONSTRAINT IF EXISTS deal_scoring_adjustments_deal_id_fkey,
    ADD CONSTRAINT deal_scoring_adjustments_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_alerts') THEN
  DELETE FROM public.deal_alerts WHERE deal_id NOT IN (SELECT id FROM public.deals);
  ALTER TABLE public.deal_alerts
    DROP CONSTRAINT IF EXISTS deal_alerts_deal_id_fkey,
    ADD CONSTRAINT deal_alerts_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
END IF;

-- remarketing child tables → remarketing_buyers (CASCADE)
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'remarketing_scores') THEN
  DELETE FROM public.remarketing_scores WHERE buyer_id NOT IN (SELECT id FROM public.remarketing_buyers);
  ALTER TABLE public.remarketing_scores
    DROP CONSTRAINT IF EXISTS remarketing_scores_buyer_id_fkey,
    ADD CONSTRAINT remarketing_scores_buyer_id_fkey
      FOREIGN KEY (buyer_id) REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'remarketing_buyer_contacts') THEN
  DELETE FROM public.remarketing_buyer_contacts WHERE buyer_id NOT IN (SELECT id FROM public.remarketing_buyers);
  ALTER TABLE public.remarketing_buyer_contacts
    DROP CONSTRAINT IF EXISTS remarketing_buyer_contacts_buyer_id_fkey,
    ADD CONSTRAINT remarketing_buyer_contacts_buyer_id_fkey
      FOREIGN KEY (buyer_id) REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'firm_members') THEN
  DELETE FROM public.firm_members WHERE buyer_id NOT IN (SELECT id FROM public.remarketing_buyers);
  ALTER TABLE public.firm_members
    DROP CONSTRAINT IF EXISTS firm_members_buyer_id_fkey,
    ADD CONSTRAINT firm_members_buyer_id_fkey
      FOREIGN KEY (buyer_id) REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pe_firm_contacts') THEN
  DELETE FROM public.pe_firm_contacts WHERE buyer_id NOT IN (SELECT id FROM public.remarketing_buyers);
  ALTER TABLE public.pe_firm_contacts
    DROP CONSTRAINT IF EXISTS pe_firm_contacts_buyer_id_fkey,
    ADD CONSTRAINT pe_firm_contacts_buyer_id_fkey
      FOREIGN KEY (buyer_id) REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE;
END IF;

-- ============================================
-- 3. Missing indexes for performance
-- ============================================

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_activities') THEN
  CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_id ON public.deal_activities(deal_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_comments') THEN
  CREATE INDEX IF NOT EXISTS idx_deal_comments_deal_id ON public.deal_comments(deal_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_contacts') THEN
  CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal_id ON public.deal_contacts(deal_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_notes') THEN
  CREATE INDEX IF NOT EXISTS idx_deal_notes_deal_id ON public.deal_notes(deal_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_tasks') THEN
  CREATE INDEX IF NOT EXISTS idx_deal_tasks_deal_id ON public.deal_tasks(deal_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_documents') THEN
  CREATE INDEX IF NOT EXISTS idx_deal_documents_deal_id ON public.deal_documents(deal_id);
END IF;

IF EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'deal_transcripts' AND column_name = 'deal_id'
) THEN
  CREATE INDEX IF NOT EXISTS idx_deal_transcripts_deal_id ON public.deal_transcripts(deal_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_referrals') THEN
  CREATE INDEX IF NOT EXISTS idx_deal_referrals_deal_id ON public.deal_referrals(deal_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inbound_leads') THEN
  CREATE INDEX IF NOT EXISTS idx_inbound_leads_listing ON public.inbound_leads(mapped_to_listing_id) WHERE mapped_to_listing_id IS NOT NULL;
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'remarketing_scores') THEN
  CREATE INDEX IF NOT EXISTS idx_remarketing_scores_buyer_id ON public.remarketing_scores(buyer_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'remarketing_buyer_contacts') THEN
  CREATE INDEX IF NOT EXISTS idx_remarketing_buyer_contacts_buyer ON public.remarketing_buyer_contacts(buyer_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'firm_members') THEN
  CREATE INDEX IF NOT EXISTS idx_firm_members_buyer_id ON public.firm_members(buyer_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pe_firm_contacts') THEN
  CREATE INDEX IF NOT EXISTS idx_pe_firm_contacts_buyer_id ON public.pe_firm_contacts(buyer_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_sessions') THEN
  CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'page_views') THEN
  CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON public.page_views(session_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_events') THEN
  CREATE INDEX IF NOT EXISTS idx_user_events_session_id ON public.user_events(session_id);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'listing_analytics') THEN
  CREATE INDEX IF NOT EXISTS idx_listing_analytics_listing_id ON public.listing_analytics(listing_id);
END IF;

END $$;
