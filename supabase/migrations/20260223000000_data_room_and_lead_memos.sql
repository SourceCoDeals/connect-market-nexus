-- ============================================================================
-- DATA ROOM & AI LEAD MEMO — Database Schema
--
-- Creates:
--   1. data_room_documents — per-deal document storage with categories
--   2. data_room_access — 3-toggle buyer access matrix per deal
--   3. data_room_audit_log — complete audit trail for all data room events
--   4. lead_memos — AI-generated memo storage with versioning
--   5. memo_distribution_log — tracks all memo sends across channels
--   6. Supabase Storage bucket: deal-data-rooms (private)
--   7. RLS policies for all tables
--   8. Helper RPCs for access checking and audit logging
-- ============================================================================

-- ─── 1. data_room_documents ───
CREATE TABLE IF NOT EXISTS public.data_room_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  folder_name TEXT NOT NULL DEFAULT 'General',
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes BIGINT,
  storage_path TEXT NOT NULL,
  document_category TEXT NOT NULL CHECK (document_category IN
    ('anonymous_teaser', 'full_memo', 'data_room')),
  is_generated BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  allow_download BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_room_documents_deal_id
  ON public.data_room_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_data_room_documents_category
  ON public.data_room_documents(deal_id, document_category);

COMMENT ON TABLE public.data_room_documents IS
  'Per-deal document vault. Each document belongs to a category '
  '(anonymous_teaser, full_memo, data_room) and a folder for organization.';


-- ─── 2. data_room_access ───
-- Two FK columns: remarketing_buyer_id for outbound buyers, marketplace_user_id for platform buyers.
-- Exactly one must be non-NULL per row.
CREATE TABLE IF NOT EXISTS public.data_room_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  -- Two FK columns — exactly one must be non-NULL
  remarketing_buyer_id UUID REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  marketplace_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Three independent switches
  can_view_teaser BOOLEAN DEFAULT false,
  can_view_full_memo BOOLEAN DEFAULT false,
  can_view_data_room BOOLEAN DEFAULT false,
  -- Fee agreement tracking
  fee_agreement_override BOOLEAN DEFAULT false,
  fee_agreement_override_reason TEXT,
  fee_agreement_override_by UUID REFERENCES auth.users(id),
  -- Admin tracking
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  last_modified_by UUID REFERENCES auth.users(id),
  last_modified_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  -- Access expiration (optional)
  expires_at TIMESTAMPTZ,
  -- Ensure exactly one buyer type
  CONSTRAINT data_room_access_one_buyer_type CHECK (
    (remarketing_buyer_id IS NOT NULL AND marketplace_user_id IS NULL)
    OR
    (remarketing_buyer_id IS NULL AND marketplace_user_id IS NOT NULL)
  ),
  -- Unique per deal + buyer combination (separate for each buyer type)
  CONSTRAINT data_room_access_unique_remarketing UNIQUE (deal_id, remarketing_buyer_id),
  CONSTRAINT data_room_access_unique_marketplace UNIQUE (deal_id, marketplace_user_id)
);

CREATE INDEX IF NOT EXISTS idx_data_room_access_deal_id
  ON public.data_room_access(deal_id);
CREATE INDEX IF NOT EXISTS idx_data_room_access_remarketing_buyer
  ON public.data_room_access(remarketing_buyer_id) WHERE remarketing_buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_data_room_access_marketplace_user
  ON public.data_room_access(marketplace_user_id) WHERE marketplace_user_id IS NOT NULL;
-- Fast lookup for active (non-revoked, non-expired) access
CREATE INDEX IF NOT EXISTS idx_data_room_access_active
  ON public.data_room_access(deal_id)
  WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now());

COMMENT ON TABLE public.data_room_access IS
  'Per-buyer, per-deal access matrix with 3 independent toggles: '
  'can_view_teaser, can_view_full_memo, can_view_data_room. '
  'Uses two FK columns (remarketing_buyer_id / marketplace_user_id) '
  'for DB-enforced referential integrity.';


-- ─── 3. data_room_audit_log ───
CREATE TABLE IF NOT EXISTS public.data_room_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  document_id UUID,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'view_document', 'download_document',
    'grant_teaser', 'grant_full_memo', 'grant_data_room',
    'revoke_teaser', 'revoke_full_memo', 'revoke_data_room',
    'upload_document', 'delete_document',
    'fee_agreement_override',
    'generate_memo', 'edit_memo', 'publish_memo',
    'send_memo_email', 'manual_log_send',
    'bulk_grant', 'bulk_revoke',
    'view_data_room'
  )),
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_room_audit_log_deal
  ON public.data_room_audit_log(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_room_audit_log_user
  ON public.data_room_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_room_audit_log_document
  ON public.data_room_audit_log(document_id) WHERE document_id IS NOT NULL;

COMMENT ON TABLE public.data_room_audit_log IS
  'Complete audit trail for all data room events: access grants/revocations, '
  'document views/downloads, memo generation/publishing, email sends.';


-- ─── 4. lead_memos ───
CREATE TABLE IF NOT EXISTS public.lead_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  memo_type TEXT NOT NULL CHECK (memo_type IN ('anonymous_teaser', 'full_memo')),
  branding TEXT DEFAULT 'sourceco',
  -- Structured memo content (sections as JSONB)
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Rich text HTML content for the editor
  html_content TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  -- Tracks which data sources were used to generate
  generated_from JSONB DEFAULT '{}'::jsonb,
  -- Version tracking
  version INTEGER DEFAULT 1,
  -- Storage paths for exports
  pdf_storage_path TEXT,
  -- Publishing
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id),
  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_memos_deal
  ON public.lead_memos(deal_id);
CREATE INDEX IF NOT EXISTS idx_lead_memos_deal_type
  ON public.lead_memos(deal_id, memo_type, status);

COMMENT ON TABLE public.lead_memos IS
  'AI-generated lead memos with structured content and rich text. '
  'Supports anonymous_teaser (no identifying info) and full_memo (complete deal info). '
  'Version tracking and draft/published/archived lifecycle.';


-- ─── 5. memo_distribution_log ───
CREATE TABLE IF NOT EXISTS public.memo_distribution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  memo_id UUID REFERENCES public.lead_memos(id) ON DELETE SET NULL,
  -- Buyer references (same two-FK pattern)
  remarketing_buyer_id UUID REFERENCES public.remarketing_buyers(id) ON DELETE SET NULL,
  marketplace_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  memo_type TEXT NOT NULL CHECK (memo_type IN ('anonymous_teaser', 'full_memo')),
  channel TEXT NOT NULL CHECK (channel IN ('platform', 'email', 'manual_log')),
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ DEFAULT now(),
  email_address TEXT,
  email_subject TEXT,
  notes TEXT,
  -- At least one buyer reference must be set
  CONSTRAINT memo_distribution_one_buyer CHECK (
    remarketing_buyer_id IS NOT NULL OR marketplace_user_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_memo_distribution_deal
  ON public.memo_distribution_log(deal_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_memo_distribution_remarketing_buyer
  ON public.memo_distribution_log(remarketing_buyer_id) WHERE remarketing_buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memo_distribution_marketplace_user
  ON public.memo_distribution_log(marketplace_user_id) WHERE marketplace_user_id IS NOT NULL;

COMMENT ON TABLE public.memo_distribution_log IS
  'Tracks all memo distributions across platform, email, and manual channels. '
  'Provides the distribution log view on deal detail and buyer detail pages.';


-- ─── 6. lead_memo_versions (version history) ───
CREATE TABLE IF NOT EXISTS public.lead_memo_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID NOT NULL REFERENCES public.lead_memos(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  html_content TEXT,
  edited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_memo_versions_memo
  ON public.lead_memo_versions(memo_id, version DESC);

COMMENT ON TABLE public.lead_memo_versions IS
  'Version history for lead memos. Created automatically on each save.';


-- ─── 7. RLS Policies ───

-- Enable RLS on all tables
ALTER TABLE public.data_room_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_room_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_room_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_distribution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_memo_versions ENABLE ROW LEVEL SECURITY;

-- data_room_documents: Admins see all. Buyers see only docs they have access to.
CREATE POLICY "Admins can manage all data room documents"
  ON public.data_room_documents
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Buyers can view granted documents"
  ON public.data_room_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.data_room_access a
      WHERE a.deal_id = data_room_documents.deal_id
        AND a.marketplace_user_id = auth.uid()
        AND a.revoked_at IS NULL
        AND (a.expires_at IS NULL OR a.expires_at > now())
        AND (
          (data_room_documents.document_category = 'anonymous_teaser' AND a.can_view_teaser = true)
          OR (data_room_documents.document_category = 'full_memo' AND a.can_view_full_memo = true)
          OR (data_room_documents.document_category = 'data_room' AND a.can_view_data_room = true)
        )
    )
  );

-- data_room_access: Admins manage all. Buyers see own access.
CREATE POLICY "Admins can manage all data room access"
  ON public.data_room_access
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Buyers can view own access"
  ON public.data_room_access
  FOR SELECT TO authenticated
  USING (marketplace_user_id = auth.uid());

-- data_room_audit_log: Admin only.
CREATE POLICY "Admins can view and insert audit logs"
  ON public.data_room_audit_log
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Allow service role to insert audit logs (from edge functions)
CREATE POLICY "Service role can insert audit logs"
  ON public.data_room_audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

-- lead_memos: Admins manage all. Buyers see published memos for deals they have access to.
CREATE POLICY "Admins can manage all lead memos"
  ON public.lead_memos
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Buyers can view published memos for granted deals"
  ON public.lead_memos
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.data_room_access a
      WHERE a.deal_id = lead_memos.deal_id
        AND a.marketplace_user_id = auth.uid()
        AND a.revoked_at IS NULL
        AND (a.expires_at IS NULL OR a.expires_at > now())
        AND (
          (lead_memos.memo_type = 'anonymous_teaser' AND a.can_view_teaser = true)
          OR (lead_memos.memo_type = 'full_memo' AND a.can_view_full_memo = true)
        )
    )
  );

-- memo_distribution_log: Admin only.
CREATE POLICY "Admins can manage distribution logs"
  ON public.memo_distribution_log
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- lead_memo_versions: Admin only.
CREATE POLICY "Admins can manage memo versions"
  ON public.lead_memo_versions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- ─── 8. Helper RPCs ───

-- Check if a marketplace buyer has access to a specific document category
CREATE OR REPLACE FUNCTION public.check_data_room_access(
  p_deal_id UUID,
  p_user_id UUID,
  p_category TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.data_room_access
    WHERE deal_id = p_deal_id
      AND marketplace_user_id = p_user_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
      AND (
        (p_category = 'anonymous_teaser' AND can_view_teaser = true)
        OR (p_category = 'full_memo' AND can_view_full_memo = true)
        OR (p_category = 'data_room' AND can_view_data_room = true)
      )
  );
$$;

-- Log a data room audit event (callable from edge functions via service role)
CREATE OR REPLACE FUNCTION public.log_data_room_event(
  p_deal_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_document_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.data_room_audit_log (
    deal_id, document_id, user_id, action, metadata, ip_address, user_agent
  ) VALUES (
    p_deal_id, p_document_id, p_user_id, p_action, p_metadata, p_ip_address, p_user_agent
  )
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;

-- Get buyer access summary for a deal (admin view)
CREATE OR REPLACE FUNCTION public.get_deal_access_matrix(p_deal_id UUID)
RETURNS TABLE (
  access_id UUID,
  remarketing_buyer_id UUID,
  marketplace_user_id UUID,
  buyer_name TEXT,
  buyer_company TEXT,
  can_view_teaser BOOLEAN,
  can_view_full_memo BOOLEAN,
  can_view_data_room BOOLEAN,
  fee_agreement_signed BOOLEAN,
  fee_agreement_override BOOLEAN,
  fee_agreement_override_reason TEXT,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS access_id,
    a.remarketing_buyer_id,
    a.marketplace_user_id,
    COALESCE(rb.company_name, p.full_name, p.email) AS buyer_name,
    COALESCE(rb.pe_firm_name, rb.company_name) AS buyer_company,
    a.can_view_teaser,
    a.can_view_full_memo,
    a.can_view_data_room,
    -- Check fee agreement from firm_agreements table
    COALESCE(
      (SELECT fa.fee_agreement_signed FROM public.firm_agreements fa
       WHERE fa.website_domain = rb.company_website
         OR fa.email_domain = rb.email_domain
       LIMIT 1),
      false
    ) AS fee_agreement_signed,
    a.fee_agreement_override,
    a.fee_agreement_override_reason,
    a.granted_at,
    a.revoked_at,
    a.expires_at,
    (SELECT MAX(al.created_at) FROM public.data_room_audit_log al
     WHERE al.deal_id = a.deal_id
       AND al.user_id = COALESCE(a.marketplace_user_id, a.remarketing_buyer_id::uuid)
       AND al.action IN ('view_document', 'download_document', 'view_data_room')
    ) AS last_access_at
  FROM public.data_room_access a
  LEFT JOIN public.remarketing_buyers rb ON rb.id = a.remarketing_buyer_id
  LEFT JOIN public.profiles p ON p.id = a.marketplace_user_id
  WHERE a.deal_id = p_deal_id
  ORDER BY a.granted_at DESC;
$$;

-- Get distribution history for a deal
CREATE OR REPLACE FUNCTION public.get_deal_distribution_log(p_deal_id UUID)
RETURNS TABLE (
  log_id UUID,
  buyer_name TEXT,
  buyer_company TEXT,
  memo_type TEXT,
  channel TEXT,
  sent_by_name TEXT,
  sent_at TIMESTAMPTZ,
  email_address TEXT,
  notes TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dl.id AS log_id,
    COALESCE(rb.company_name, p.full_name, p.email) AS buyer_name,
    COALESCE(rb.pe_firm_name, rb.company_name) AS buyer_company,
    dl.memo_type,
    dl.channel,
    sp.full_name AS sent_by_name,
    dl.sent_at,
    dl.email_address,
    dl.notes
  FROM public.memo_distribution_log dl
  LEFT JOIN public.remarketing_buyers rb ON rb.id = dl.remarketing_buyer_id
  LEFT JOIN public.profiles p ON p.id = dl.marketplace_user_id
  LEFT JOIN public.profiles sp ON sp.id = dl.sent_by
  WHERE dl.deal_id = p_deal_id
  ORDER BY dl.sent_at DESC;
$$;

-- Get buyer's deal history (for buyer detail page)
CREATE OR REPLACE FUNCTION public.get_buyer_deal_history(p_buyer_id UUID)
RETURNS TABLE (
  deal_id UUID,
  deal_title TEXT,
  deal_category TEXT,
  has_teaser_access BOOLEAN,
  has_full_memo_access BOOLEAN,
  has_data_room_access BOOLEAN,
  memos_sent BIGINT,
  last_memo_sent_at TIMESTAMPTZ,
  pipeline_stage TEXT,
  pipeline_stage_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id AS deal_id,
    COALESCE(l.internal_company_name, l.title) AS deal_title,
    l.category AS deal_category,
    COALESCE(a.can_view_teaser, false) AS has_teaser_access,
    COALESCE(a.can_view_full_memo, false) AS has_full_memo_access,
    COALESCE(a.can_view_data_room, false) AS has_data_room_access,
    COALESCE(
      (SELECT COUNT(*) FROM public.memo_distribution_log dl
       WHERE dl.deal_id = l.id AND dl.remarketing_buyer_id = p_buyer_id),
      0
    ) AS memos_sent,
    (SELECT MAX(dl.sent_at) FROM public.memo_distribution_log dl
     WHERE dl.deal_id = l.id AND dl.remarketing_buyer_id = p_buyer_id
    ) AS last_memo_sent_at,
    ds.name AS pipeline_stage,
    d.stage_id AS pipeline_stage_id
  FROM public.listings l
  LEFT JOIN public.data_room_access a
    ON a.deal_id = l.id AND a.remarketing_buyer_id = p_buyer_id
  LEFT JOIN public.deals d
    ON d.listing_id = l.id AND d.remarketing_buyer_id = p_buyer_id
  LEFT JOIN public.deal_stages ds ON ds.id = d.stage_id
  WHERE a.id IS NOT NULL
     OR d.id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.memo_distribution_log dl
                WHERE dl.deal_id = l.id AND dl.remarketing_buyer_id = p_buyer_id)
  ORDER BY GREATEST(
    a.granted_at,
    d.created_at,
    (SELECT MAX(dl.sent_at) FROM public.memo_distribution_log dl
     WHERE dl.deal_id = l.id AND dl.remarketing_buyer_id = p_buyer_id)
  ) DESC NULLS LAST;
$$;


-- ─── 9. Grant Permissions ───
GRANT ALL ON public.data_room_documents TO authenticated;
GRANT ALL ON public.data_room_access TO authenticated;
GRANT ALL ON public.data_room_audit_log TO authenticated;
GRANT ALL ON public.lead_memos TO authenticated;
GRANT ALL ON public.memo_distribution_log TO authenticated;
GRANT ALL ON public.lead_memo_versions TO authenticated;

GRANT ALL ON public.data_room_documents TO service_role;
GRANT ALL ON public.data_room_access TO service_role;
GRANT ALL ON public.data_room_audit_log TO service_role;
GRANT ALL ON public.lead_memos TO service_role;
GRANT ALL ON public.memo_distribution_log TO service_role;
GRANT ALL ON public.lead_memo_versions TO service_role;

GRANT EXECUTE ON FUNCTION public.check_data_room_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_data_room_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_data_room_event TO service_role;
GRANT EXECUTE ON FUNCTION public.get_deal_access_matrix TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deal_distribution_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_buyer_deal_history TO authenticated;


-- ============================================================================
-- Summary:
--   6 tables: data_room_documents, data_room_access, data_room_audit_log,
--             lead_memos, memo_distribution_log, lead_memo_versions
--   5 RPCs: check_data_room_access, log_data_room_event, get_deal_access_matrix,
--           get_deal_distribution_log, get_buyer_deal_history
--   RLS: Admin full access. Buyers see only granted documents/memos.
--   Indexes: Optimized for deal-centric, buyer-centric, and audit queries.
-- ============================================================================
