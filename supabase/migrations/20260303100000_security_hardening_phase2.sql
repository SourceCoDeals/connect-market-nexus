-- Migration: Security Hardening Phase 2
-- Adds missing RLS, fixes overly permissive policies, standardizes admin checks,
-- and adds auth guards to unprotected SECURITY DEFINER RPCs.
--
-- IMPORTANT: All SECURITY DEFINER functions that write to connection_requests or
-- saved_listings already bypass RLS (by design), so enabling RLS on these tables
-- will NOT break existing write paths through RPCs/edge functions.

BEGIN;

-- ============================================================================
-- SECTION A: Add Missing RLS (P0 Critical)
-- ============================================================================

-- A1. saved_listings — currently has NO RLS, any authenticated user can read/write all rows
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved listings"
  ON public.saved_listings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all saved listings"
  ON public.saved_listings
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role full access to saved listings"
  ON public.saved_listings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- A2. connection_requests — THE deals table, currently has NO RLS
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connection requests"
  ON public.connection_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can insert own connection requests"
  ON public.connection_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can update own connection requests"
  ON public.connection_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete connection requests"
  ON public.connection_requests
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role full access to connection requests"
  ON public.connection_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- SECTION B: Fix Overly Permissive Policies (P0)
-- ============================================================================

-- B1. buyers / buyer_contacts / buyer_deal_scores — drop USING(true) policies
-- The admin-only policies from 20260203003716 remain in place
DROP POLICY IF EXISTS "Users can manage buyers" ON public.buyers;
DROP POLICY IF EXISTS "Users can manage buyer_deal_scores" ON public.buyer_deal_scores;
DROP POLICY IF EXISTS "Users can manage buyer_contacts" ON public.buyer_contacts;

-- B2. admin_notifications — replace open authenticated INSERT with scoped policies
-- Old policy allowed ANY authenticated user to insert; new policies restrict to admin + service_role
DROP POLICY IF EXISTS "Authenticated system can insert notifications" ON public.admin_notifications;
CREATE POLICY "Service role can insert admin notifications"
  ON public.admin_notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);
CREATE POLICY "Admins can insert admin notifications"
  ON public.admin_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- B3. user_notifications — replace open authenticated INSERT with scoped policies
DROP POLICY IF EXISTS "Authenticated can insert user notifications" ON public.user_notifications;
CREATE POLICY "Service role can insert user notifications"
  ON public.user_notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);
CREATE POLICY "Admins can insert user notifications"
  ON public.user_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- B4. user_journeys — "Service role can manage journeys" is missing TO service_role
DROP POLICY IF EXISTS "Service role can manage journeys" ON public.user_journeys;
CREATE POLICY "Service role can manage journeys"
  ON public.user_journeys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- B5. captarget_sync_exclusions — "Service role can manage" is missing TO service_role
DROP POLICY IF EXISTS "Service role can manage captarget sync exclusions" ON public.captarget_sync_exclusions;
CREATE POLICY "Service role can manage captarget sync exclusions"
  ON public.captarget_sync_exclusions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- SECTION C: Standardize Admin Check Patterns (P1)
-- Replace non-canonical admin checks with public.is_admin(auth.uid())
-- ============================================================================

-- C1. call_transcripts — uses raw_user_meta_data->>'role' instead of is_admin()
DROP POLICY IF EXISTS "Admin full access to call transcripts" ON public.call_transcripts;
CREATE POLICY "Admin full access to call transcripts"
  ON public.call_transcripts
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- C2. engagement_signals — uses raw_user_meta_data->>'role' instead of is_admin()
DROP POLICY IF EXISTS "Admin full access to engagement signals" ON public.engagement_signals;
CREATE POLICY "Admin full access to engagement signals"
  ON public.engagement_signals
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- C3. captarget_sync_exclusions — uses profiles.role = 'admin' instead of is_admin()
DROP POLICY IF EXISTS "Admin users can view captarget sync exclusions" ON public.captarget_sync_exclusions;
CREATE POLICY "Admin users can view captarget sync exclusions"
  ON public.captarget_sync_exclusions
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- C4. captarget_sync_log — uses profiles.role = 'admin' instead of is_admin()
DROP POLICY IF EXISTS "Admin users can view captarget sync logs" ON public.captarget_sync_log;
CREATE POLICY "Admin users can view captarget sync logs"
  ON public.captarget_sync_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- C5. remarketing_scoring_queue — uses profiles.role = 'admin' instead of is_admin()
DROP POLICY IF EXISTS "Admins can manage scoring queue" ON public.remarketing_scoring_queue;
CREATE POLICY "Admins can manage scoring queue"
  ON public.remarketing_scoring_queue
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- C6. remarketing_scores — "scores_select_policy" uses auth.jwt() ->> 'is_admin'
DROP POLICY IF EXISTS "scores_select_policy" ON public.remarketing_scores;
CREATE POLICY "scores_select_policy"
  ON public.remarketing_scores
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL OR public.is_admin(auth.uid()));

-- ============================================================================
-- SECTION D: Add Auth Checks to Unprotected SECURITY DEFINER RPCs (P1)
-- These functions bypass RLS but have no authorization check — any authenticated
-- user can call them and see all data.
-- ============================================================================

-- D1. get_deals_with_details() — admin-only deal pipeline view
CREATE OR REPLACE FUNCTION public.get_deals_with_details()
RETURNS TABLE (
  deal_id uuid,
  deal_title text,
  deal_description text,
  deal_value numeric,
  deal_probability integer,
  deal_expected_close_date date,
  deal_created_at timestamp with time zone,
  deal_updated_at timestamp with time zone,
  deal_stage_entered_at timestamp with time zone,
  deal_followed_up boolean,
  deal_followed_up_at timestamp with time zone,
  deal_followed_up_by uuid,
  deal_negative_followed_up boolean,
  deal_negative_followed_up_at timestamp with time zone,
  deal_negative_followed_up_by uuid,
  deal_buyer_priority_score integer,
  deal_priority text,
  deal_source text,
  stage_id uuid,
  stage_name text,
  stage_color text,
  stage_position integer,
  listing_id uuid,
  listing_title text,
  listing_category text,
  listing_real_company_name text,
  listing_revenue numeric,
  listing_ebitda numeric,
  listing_location text,
  connection_request_id uuid,
  buyer_id uuid,
  buyer_name text,
  buyer_email text,
  buyer_company text,
  buyer_phone text,
  buyer_type text,
  assigned_to uuid,
  contact_name text,
  contact_email text,
  contact_company text,
  contact_phone text,
  contact_role text,
  nda_status text,
  fee_agreement_status text,
  last_contact_at timestamp with time zone,
  total_activities integer,
  pending_tasks integer,
  total_tasks integer,
  completed_tasks integer,
  last_activity_at timestamp with time zone,
  company_deal_count bigint,
  listing_deal_count bigint,
  buyer_connection_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auth guard: admin-only
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    d.id as deal_id,
    d.title as deal_title,
    d.description as deal_description,
    d.value as deal_value,
    d.probability as deal_probability,
    d.expected_close_date as deal_expected_close_date,
    d.created_at as deal_created_at,
    d.updated_at as deal_updated_at,
    d.stage_entered_at as deal_stage_entered_at,
    d.followed_up as deal_followed_up,
    d.followed_up_at as deal_followed_up_at,
    d.followed_up_by as deal_followed_up_by,
    d.negative_followed_up as deal_negative_followed_up,
    d.negative_followed_up_at as deal_negative_followed_up_at,
    d.negative_followed_up_by as deal_negative_followed_up_by,
    d.buyer_priority_score as deal_buyer_priority_score,
    d.priority as deal_priority,
    d.source as deal_source,
    ds.id as stage_id,
    ds.name as stage_name,
    ds.color as stage_color,
    ds.position as stage_position,
    d.listing_id,
    l.title as listing_title,
    l.category as listing_category,
    l.internal_company_name as listing_real_company_name,
    l.revenue as listing_revenue,
    l.ebitda as listing_ebitda,
    l.location as listing_location,
    d.connection_request_id,
    p.id as buyer_id,
    COALESCE(p.first_name || ' ' || p.last_name, p.email) as buyer_name,
    p.email as buyer_email,
    p.company as buyer_company,
    p.phone_number as buyer_phone,
    p.buyer_type,
    d.assigned_to,
    CASE
      WHEN d.contact_name IS NOT NULL AND d.contact_name != '' AND d.contact_name != 'Unknown' AND d.contact_name != 'Unknown Contact'
        THEN d.contact_name
      WHEN p.first_name IS NOT NULL OR p.last_name IS NOT NULL
        THEN COALESCE(p.first_name || ' ' || p.last_name, p.email)
      WHEN cr.lead_name IS NOT NULL AND cr.lead_name != ''
        THEN cr.lead_name
      ELSE 'Unknown Contact'
    END as contact_name,
    COALESCE(NULLIF(d.contact_email, ''), p.email, cr.lead_email) as contact_email,
    COALESCE(NULLIF(d.contact_company, ''), p.company, cr.lead_company) as contact_company,
    COALESCE(NULLIF(d.contact_phone, ''), p.phone_number, cr.lead_phone) as contact_phone,
    d.contact_role,
    d.nda_status,
    d.fee_agreement_status,
    (
      SELECT MAX(dc.created_at)
      FROM deal_contacts dc
      WHERE dc.deal_id = d.id
    ) as last_contact_at,
    (
      SELECT COUNT(*)::integer
      FROM deal_activities da
      WHERE da.deal_id = d.id
    ) as total_activities,
    (
      SELECT COUNT(*)::integer
      FROM deal_tasks dt
      WHERE dt.deal_id = d.id AND dt.status = 'pending'
    ) as pending_tasks,
    (
      SELECT COUNT(*)::integer
      FROM deal_tasks dt
      WHERE dt.deal_id = d.id
    ) as total_tasks,
    (
      SELECT COUNT(*)::integer
      FROM deal_tasks dt
      WHERE dt.deal_id = d.id AND dt.status = 'completed'
    ) as completed_tasks,
    GREATEST(
      d.updated_at,
      (SELECT MAX(da.created_at) FROM deal_activities da WHERE da.deal_id = d.id),
      (SELECT MAX(dt.updated_at) FROM deal_tasks dt WHERE dt.deal_id = d.id)
    ) as last_activity_at,
    COUNT(*) OVER (PARTITION BY COALESCE(l.internal_company_name, d.contact_company, p.company)) as company_deal_count,
    COUNT(*) OVER (PARTITION BY d.listing_id) as listing_deal_count,
    (
      SELECT COUNT(*)::bigint
      FROM connection_requests cr_count
      WHERE (cr_count.user_id = cr.user_id AND cr.user_id IS NOT NULL)
         OR (cr_count.lead_email = COALESCE(NULLIF(d.contact_email, ''), p.email, cr.lead_email) AND cr_count.lead_email IS NOT NULL)
    ) as buyer_connection_count
  FROM deals d
  LEFT JOIN deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN listings l ON d.listing_id = l.id
  LEFT JOIN connection_requests cr ON d.connection_request_id = cr.id
  LEFT JOIN profiles p ON cr.user_id = p.id
  WHERE d.deleted_at IS NULL
  ORDER BY d.created_at DESC;
END;
$$;

-- D2. reset_all_admin_notifications() — admin-only bulk reset
CREATE OR REPLACE FUNCTION public.reset_all_admin_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Auth guard: admin-only
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  UPDATE admin_notifications SET is_read = false, read_at = NULL;
END;
$$;

-- D3. restore_soft_deleted(text, uuid) — admin-only record restoration
--     Particularly sensitive: uses EXECUTE format() with table name
CREATE OR REPLACE FUNCTION public.restore_soft_deleted(
  p_table_name TEXT,
  p_record_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Auth guard: admin-only
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL WHERE id = $1',
    p_table_name
  ) USING p_record_id;

  RETURN FOUND;
END;
$$;

-- D4. get_deal_access_matrix(uuid) — admin-only deal access view
--     Converted from SQL to plpgsql to add auth guard
--     Uses latest signature from 20260228100000 (contact_id, contact_title, access_token)
CREATE OR REPLACE FUNCTION public.get_deal_access_matrix(p_deal_id UUID)
RETURNS TABLE (
  access_id UUID,
  remarketing_buyer_id UUID,
  marketplace_user_id UUID,
  contact_id UUID,
  buyer_name TEXT,
  buyer_company TEXT,
  contact_title TEXT,
  can_view_teaser BOOLEAN,
  can_view_full_memo BOOLEAN,
  can_view_data_room BOOLEAN,
  fee_agreement_signed BOOLEAN,
  fee_agreement_override BOOLEAN,
  fee_agreement_override_reason TEXT,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ,
  access_token UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auth guard: admin-only
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    a.id AS access_id,
    a.remarketing_buyer_id,
    a.marketplace_user_id,
    a.contact_id,
    COALESCE(
      NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''),
      rb.company_name,
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      p.email
    ) AS buyer_name,
    COALESCE(
      fa.primary_company_name,
      rb.pe_firm_name,
      rb.company_name
    ) AS buyer_company,
    c.title AS contact_title,
    a.can_view_teaser,
    a.can_view_full_memo,
    a.can_view_data_room,
    COALESCE(
      (SELECT fac.fee_agreement_status = 'signed'
       FROM public.firm_agreements fac
       WHERE fac.id = c.firm_id
       LIMIT 1),
      (SELECT fal.fee_agreement_status = 'signed'
       FROM public.firm_agreements fal
       WHERE (fal.email_domain = rb.email_domain OR fal.website_domain IS NOT NULL)
         AND rb.email_domain IS NOT NULL
         AND fal.email_domain = rb.email_domain
       LIMIT 1),
      false
    ) AS fee_agreement_signed,
    a.fee_agreement_override,
    a.fee_agreement_override_reason,
    a.granted_at,
    a.revoked_at,
    a.expires_at,
    COALESCE(
      a.last_access_at,
      (SELECT MAX(al.created_at) FROM public.data_room_audit_log al
       WHERE al.deal_id = a.deal_id
         AND al.user_id = COALESCE(a.marketplace_user_id, a.remarketing_buyer_id::uuid)
         AND al.action IN ('view_document', 'download_document', 'view_data_room'))
    ) AS last_access_at,
    a.access_token
  FROM public.data_room_access a
  LEFT JOIN public.contacts c ON c.id = a.contact_id
  LEFT JOIN public.firm_agreements fa ON fa.id = c.firm_id
  LEFT JOIN public.remarketing_buyers rb ON rb.id = a.remarketing_buyer_id
  LEFT JOIN public.profiles p ON p.id = a.marketplace_user_id
  WHERE a.deal_id = p_deal_id
  ORDER BY a.granted_at DESC;
END;
$$;

-- D5. get_deal_distribution_log(uuid) — admin-only distribution history
--     Converted from SQL to plpgsql to add auth guard
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auth guard: admin-only
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    dl.id AS log_id,
    COALESCE(rb.company_name, NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''), p.email) AS buyer_name,
    COALESCE(rb.pe_firm_name, rb.company_name) AS buyer_company,
    dl.memo_type,
    dl.channel,
    NULLIF(TRIM(sp.first_name || ' ' || sp.last_name), '') AS sent_by_name,
    dl.sent_at,
    dl.email_address,
    dl.notes
  FROM public.memo_distribution_log dl
  LEFT JOIN public.remarketing_buyers rb ON rb.id = dl.remarketing_buyer_id
  LEFT JOIN public.profiles p ON p.id = dl.marketplace_user_id
  LEFT JOIN public.profiles sp ON sp.id = dl.sent_by
  WHERE dl.deal_id = p_deal_id
  ORDER BY dl.sent_at DESC;
END;
$$;

-- D6. get_buyer_deal_history(uuid) — admin-only buyer history view
--     Converted from SQL to plpgsql to add auth guard
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auth guard: admin-only
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
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
END;
$$;

COMMIT;
