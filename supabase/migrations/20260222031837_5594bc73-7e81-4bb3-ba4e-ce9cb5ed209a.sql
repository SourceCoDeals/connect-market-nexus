-- ============================================================================
-- DOCUMENT DISTRIBUTION & DATA ROOM SYSTEM
--
-- Phase 1: Core database schema for document tracking, tracked links,
-- immutable release log, data room access, and marketplace approval queue.
--
-- Table name mappings (spec → actual):
--   companies → listings
--   buyers → remarketing_buyers
--   marketplace_inquiries → connection_requests
--   profiles → profiles (unchanged)
--
-- Existing tables preserved:
--   data_room_documents, data_room_access, data_room_audit_log,
--   lead_memos, memo_distribution_log, lead_memo_versions
-- ============================================================================


-- ============================================================================
-- MIGRATION 1 of 6: Add project_name to listings
-- ============================================================================
-- The project_name is the anonymous codename used in all external comms.
-- Anonymous Teaser cannot be distributed until this is set.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS project_name_set_at TIMESTAMPTZ;


-- ============================================================================
-- MIGRATION 2 of 6: deal_documents
-- ============================================================================
-- Documents associated with a deal — AI-generated memos and manually uploaded files.
-- This extends the existing data_room_documents concept with document_type tiers:
--   full_detail_memo: INTERNAL ONLY — never distributed to buyers
--   anonymous_teaser: Pre-NDA distribution to buyers
--   data_room_file: Post-NDA diligence materials

CREATE TABLE IF NOT EXISTS public.deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.listings(id) ON DELETE RESTRICT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'full_detail_memo', 'anonymous_teaser', 'data_room_file'
  )),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT DEFAULT 'application/pdf',
  version INTEGER DEFAULT 1,
  is_current BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_documents_deal_id ON public.deal_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_documents_type ON public.deal_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_deal_documents_current ON public.deal_documents(deal_id, document_type)
  WHERE is_current = true AND status = 'active';

COMMENT ON TABLE public.deal_documents IS
  'All documents for a deal: full_detail_memo (internal only), '
  'anonymous_teaser (pre-NDA), data_room_file (post-NDA). '
  'Version tracking via version + is_current flag.';


-- ============================================================================
-- MIGRATION 3 of 6: document_tracked_links
-- ============================================================================
-- One record per unique tracked link. Each link is per-buyer per-document.
-- Links open in a clean viewer with no SourceCo login required.

CREATE TABLE IF NOT EXISTS public.document_tracked_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.listings(id) NOT NULL,
  document_id UUID REFERENCES public.deal_documents(id) NOT NULL,
  buyer_id UUID REFERENCES public.remarketing_buyers(id),
  buyer_email TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_firm TEXT,
  link_token TEXT UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::TEXT, '-', ''),
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id),
  revoke_reason TEXT,
  expires_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- idx_tracked_links_token omitted: UNIQUE constraint on link_token already creates an index
CREATE INDEX IF NOT EXISTS idx_tracked_links_deal_id ON public.document_tracked_links(deal_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_buyer ON public.document_tracked_links(buyer_id)
  WHERE buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracked_links_document ON public.document_tracked_links(document_id);

COMMENT ON TABLE public.document_tracked_links IS
  'Per-buyer, per-document tracked links. Public URL: /view/{link_token}. '
  'Tracks opens, supports revocation, and serves current document version.';


-- ============================================================================
-- MIGRATION 4 of 6: document_release_log (IMMUTABLE)
-- ============================================================================
-- Permanent audit record of every document release event.
-- RLS: INSERT + SELECT only. No UPDATE (except engagement fields via service role).
-- No DELETE ever.

CREATE TABLE IF NOT EXISTS public.document_release_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.listings(id) NOT NULL,
  document_id UUID REFERENCES public.deal_documents(id) NOT NULL,
  buyer_id UUID REFERENCES public.remarketing_buyers(id),
  buyer_name TEXT NOT NULL,
  buyer_firm TEXT,
  buyer_email TEXT NOT NULL,
  release_method TEXT NOT NULL CHECK (release_method IN (
    'tracked_link', 'pdf_download', 'auto_campaign', 'data_room_grant'
  )),
  nda_status_at_release TEXT,
  fee_agreement_status_at_release TEXT,
  released_by UUID REFERENCES public.profiles(id) NOT NULL,
  released_at TIMESTAMPTZ DEFAULT now(),
  tracked_link_id UUID REFERENCES public.document_tracked_links(id),
  first_opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  last_opened_at TIMESTAMPTZ,
  release_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_release_log_deal_id ON public.document_release_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_release_log_released_at ON public.document_release_log(released_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_log_buyer ON public.document_release_log(buyer_id)
  WHERE buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_release_log_document ON public.document_release_log(document_id);

-- RLS: IMMUTABLE — admin INSERT + SELECT only. No UPDATE/DELETE for authenticated.
ALTER TABLE public.document_release_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "log_insert" ON public.document_release_log;
CREATE POLICY "log_insert" ON public.document_release_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "log_select" ON public.document_release_log;
CREATE POLICY "log_select" ON public.document_release_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Service role can update engagement fields (open_count, first_opened_at, last_opened_at)
DROP POLICY IF EXISTS "service_role_update_engagement" ON public.document_release_log;
CREATE POLICY "service_role_update_engagement" ON public.document_release_log
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON public.document_release_log;
CREATE POLICY "service_role_all" ON public.document_release_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- No DELETE policies for authenticated — records are permanent

COMMENT ON TABLE public.document_release_log IS
  'IMMUTABLE audit record of every document release. '
  'NDA/fee agreement status captured at release time and never changes. '
  'Only engagement fields (open_count, first/last_opened_at) can be updated via service role.';


-- ============================================================================
-- MIGRATION 5 of 6: deal_data_room_access
-- ============================================================================
-- Post-NDA buyer data room access. One record per buyer per deal.
-- Buyer uses a single access_token URL to view all granted documents.

CREATE TABLE IF NOT EXISTS public.deal_data_room_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.listings(id) NOT NULL,
  buyer_id UUID REFERENCES public.remarketing_buyers(id),
  buyer_email TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_firm TEXT,
  access_token TEXT UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::TEXT, '-', ''),
  granted_document_ids UUID[],
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id),
  nda_signed_at TIMESTAMPTZ,
  fee_agreement_signed_at TIMESTAMPTZ,
  granted_by UUID REFERENCES public.profiles(id) NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  UNIQUE(deal_id, buyer_email)
);

-- idx_deal_data_room_access_token omitted: UNIQUE constraint on access_token already creates an index
CREATE INDEX IF NOT EXISTS idx_deal_data_room_access_deal ON public.deal_data_room_access(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_data_room_access_buyer ON public.deal_data_room_access(buyer_id)
  WHERE buyer_id IS NOT NULL;

-- RLS
ALTER TABLE public.deal_data_room_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage deal data room access" ON public.deal_data_room_access;
CREATE POLICY "Admins can manage deal data room access"
  ON public.deal_data_room_access FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role full access" ON public.deal_data_room_access;
CREATE POLICY "Service role full access"
  ON public.deal_data_room_access FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.deal_data_room_access IS
  'Post-NDA buyer data room access. One access_token per buyer per deal. '
  'NDA/fee agreement timestamps captured at grant time as permanent record.';


-- ============================================================================
-- MIGRATION 6 of 6: marketplace_approval_queue
-- ============================================================================
-- Screens every inbound marketplace connection request before document release.
-- Manual approval required — never automated.

CREATE TABLE IF NOT EXISTS public.marketplace_approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_request_id UUID REFERENCES public.connection_requests(id) NOT NULL,
  deal_id UUID REFERENCES public.listings(id) NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_firm TEXT,
  buyer_role TEXT,
  buyer_message TEXT,
  matched_buyer_id UUID REFERENCES public.remarketing_buyers(id),
  match_confidence TEXT CHECK (match_confidence IN (
    'email_exact', 'firm_name', 'none'
  )),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'declined'
  )),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  decline_reason TEXT,
  decline_category TEXT CHECK (decline_category IS NULL OR decline_category IN (
    'not_qualified', 'wrong_size', 'competitor', 'duplicate', 'other'
  )),
  decline_email_sent BOOLEAN DEFAULT false,
  release_log_id UUID REFERENCES public.document_release_log(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON public.marketplace_approval_queue(status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_deal_id ON public.marketplace_approval_queue(deal_id);
CREATE INDEX IF NOT EXISTS idx_approval_queue_pending ON public.marketplace_approval_queue(created_at ASC)
  WHERE status = 'pending';

-- RLS
ALTER TABLE public.marketplace_approval_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage approval queue" ON public.marketplace_approval_queue;
CREATE POLICY "Admins can manage approval queue"
  ON public.marketplace_approval_queue FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role full access on approval queue" ON public.marketplace_approval_queue;
CREATE POLICY "Service role full access on approval queue"
  ON public.marketplace_approval_queue FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.marketplace_approval_queue IS
  'Mandatory screening for inbound marketplace connection requests. '
  'No documents released until a team member explicitly approves. '
  'Auto-matches buyer against remarketing_buyers universe on insert.';


-- ============================================================================
-- RLS & Grants for deal_documents and document_tracked_links
-- ============================================================================

ALTER TABLE public.deal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage deal documents" ON public.deal_documents;
CREATE POLICY "Admins can manage deal documents"
  ON public.deal_documents FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role full access on deal documents" ON public.deal_documents;
CREATE POLICY "Service role full access on deal documents"
  ON public.deal_documents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.document_tracked_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage tracked links" ON public.document_tracked_links;
CREATE POLICY "Admins can manage tracked links"
  ON public.document_tracked_links FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role full access on tracked links" ON public.document_tracked_links;
CREATE POLICY "Service role full access on tracked links"
  ON public.document_tracked_links FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.deal_documents TO authenticated;
GRANT ALL ON public.deal_documents TO service_role;

GRANT ALL ON public.document_tracked_links TO authenticated;
GRANT ALL ON public.document_tracked_links TO service_role;

-- Release log: authenticated can only SELECT and INSERT (immutable — no UPDATE/DELETE)
GRANT SELECT, INSERT ON public.document_release_log TO authenticated;
GRANT ALL ON public.document_release_log TO service_role;

GRANT ALL ON public.deal_data_room_access TO authenticated;
GRANT ALL ON public.deal_data_room_access TO service_role;

GRANT ALL ON public.marketplace_approval_queue TO authenticated;
GRANT ALL ON public.marketplace_approval_queue TO service_role;


-- ============================================================================
-- Storage bucket: deal-documents
-- ============================================================================
-- Folder structure per deal:
--   {deal_id}/internal/     ← Full Detail Memos
--   {deal_id}/marketing/    ← Anonymous Teasers
--   {deal_id}/data-room/    ← Uploaded diligence files
-- Files served via edge functions with 60s presigned URLs only.

INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-documents', 'deal-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Admins can manage all files
DROP POLICY IF EXISTS "Admins can manage deal document files" ON storage.objects;
CREATE POLICY "Admins can manage deal document files"
ON storage.objects FOR ALL
USING (bucket_id = 'deal-documents' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'deal-documents' AND public.is_admin(auth.uid()));

-- Service role full access (edge functions generate presigned URLs via service_role)
DROP POLICY IF EXISTS "Service role deal document files" ON storage.objects;
CREATE POLICY "Service role deal document files"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'deal-documents')
WITH CHECK (bucket_id = 'deal-documents');


-- ============================================================================
-- Additional indexes for buyer_email lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tracked_links_buyer_email
  ON public.document_tracked_links(buyer_email);
CREATE INDEX IF NOT EXISTS idx_release_log_buyer_email
  ON public.document_release_log(buyer_email);
CREATE INDEX IF NOT EXISTS idx_approval_queue_buyer_email
  ON public.marketplace_approval_queue(buyer_email);
CREATE INDEX IF NOT EXISTS idx_approval_queue_connection_request
  ON public.marketplace_approval_queue(connection_request_id);


-- ============================================================================
-- RPC: Atomic open_count increment (avoids read-then-write race condition)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_link_open_count(p_link_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_first_open BOOLEAN;
  v_result jsonb;
BEGIN
  -- Atomically increment and set timestamps
  UPDATE document_tracked_links
  SET
    open_count = open_count + 1,
    last_opened_at = now(),
    first_opened_at = COALESCE(first_opened_at, now())
  WHERE id = p_link_id
  RETURNING (first_opened_at = now()) INTO v_first_open;

  -- Also update the release log if this is the first open
  IF v_first_open THEN
    UPDATE document_release_log
    SET first_opened_at = now()
    WHERE tracked_link_id = p_link_id
      AND first_opened_at IS NULL;
  END IF;

  v_result := jsonb_build_object('first_open', v_first_open);
  RETURN v_result;
END;
$$;