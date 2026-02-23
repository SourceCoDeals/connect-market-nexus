
-- ============================================================================
-- CTO AUDIT PHASE 2 — Database hardening
-- ============================================================================

-- ─── 1. RLS: Enforce access expiration (item 5.3) ───
DROP POLICY IF EXISTS "Buyers can view own access" ON public.data_room_access;

CREATE POLICY "Buyers can view own access"
  ON public.data_room_access
  FOR SELECT TO authenticated
  USING (
    (
      marketplace_user_id = auth.uid()
      OR contact_id IN (
        SELECT c.id FROM public.contacts c WHERE c.profile_id = auth.uid()
      )
    )
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );

-- ─── 2. FK: CASCADE → RESTRICT on data_room_access (item 5.7) ───
ALTER TABLE public.data_room_access
  DROP CONSTRAINT IF EXISTS data_room_access_remarketing_buyer_id_fkey;

DO $$ BEGIN
  ALTER TABLE public.data_room_access
    ADD CONSTRAINT data_room_access_remarketing_buyer_id_fkey
    FOREIGN KEY (remarketing_buyer_id)
    REFERENCES public.remarketing_buyers(id)
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.data_room_access
  DROP CONSTRAINT IF EXISTS data_room_access_marketplace_user_id_fkey;

DO $$ BEGIN
  ALTER TABLE public.data_room_access
    ADD CONSTRAINT data_room_access_marketplace_user_id_fkey
    FOREIGN KEY (marketplace_user_id)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Computed access status view (item 5.10) ───
CREATE OR REPLACE VIEW public.data_room_access_status AS
SELECT
  *,
  CASE
    WHEN revoked_at IS NOT NULL THEN 'revoked'
    WHEN expires_at IS NOT NULL AND expires_at <= now() THEN 'expired'
    ELSE 'active'
  END AS access_status
FROM public.data_room_access;

COMMENT ON VIEW public.data_room_access_status IS
  'Convenience view over data_room_access with computed access_status column.';

-- ─── 4. RPC: get_deals_with_buyer_profiles (item 6.1) ───
CREATE OR REPLACE FUNCTION public.get_deals_with_buyer_profiles()
RETURNS TABLE (
  deal_id UUID,
  deal_title TEXT,
  deal_description TEXT,
  deal_value NUMERIC,
  deal_priority TEXT,
  deal_probability NUMERIC,
  deal_expected_close_date DATE,
  deal_source TEXT,
  deal_created_at TIMESTAMPTZ,
  deal_updated_at TIMESTAMPTZ,
  deal_stage_entered_at TIMESTAMPTZ,
  deal_deleted_at TIMESTAMPTZ,
  connection_request_id UUID,
  stage_id UUID,
  stage_name TEXT,
  stage_color TEXT,
  stage_position INT,
  stage_is_active BOOLEAN,
  stage_is_default BOOLEAN,
  stage_is_system_stage BOOLEAN,
  stage_default_probability NUMERIC,
  stage_type TEXT,
  listing_id UUID,
  listing_title TEXT,
  listing_revenue NUMERIC,
  listing_ebitda NUMERIC,
  listing_location TEXT,
  listing_category TEXT,
  listing_internal_company_name TEXT,
  listing_image_url TEXT,
  listing_deal_total_score NUMERIC,
  listing_is_priority_target BOOLEAN,
  listing_needs_owner_contact BOOLEAN,
  admin_id UUID,
  admin_first_name TEXT,
  admin_last_name TEXT,
  admin_email TEXT,
  buyer_type TEXT,
  buyer_website TEXT,
  buyer_quality_score NUMERIC,
  buyer_tier INT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    d.id AS deal_id,
    d.title AS deal_title,
    d.description AS deal_description,
    d.value AS deal_value,
    d.priority AS deal_priority,
    d.probability AS deal_probability,
    d.expected_close_date AS deal_expected_close_date,
    d.source AS deal_source,
    d.created_at AS deal_created_at,
    d.updated_at AS deal_updated_at,
    COALESCE(d.stage_entered_at, d.created_at) AS deal_stage_entered_at,
    d.deleted_at AS deal_deleted_at,
    d.connection_request_id,
    ds.id AS stage_id,
    ds.name AS stage_name,
    ds.color AS stage_color,
    ds.position AS stage_position,
    ds.is_active AS stage_is_active,
    ds.is_default AS stage_is_default,
    ds.is_system_stage AS stage_is_system_stage,
    ds.default_probability AS stage_default_probability,
    ds.stage_type AS stage_type,
    l.id AS listing_id,
    l.title AS listing_title,
    l.revenue AS listing_revenue,
    l.ebitda AS listing_ebitda,
    l.location AS listing_location,
    l.category AS listing_category,
    l.internal_company_name AS listing_internal_company_name,
    l.image_url AS listing_image_url,
    l.deal_total_score AS listing_deal_total_score,
    l.is_priority_target AS listing_is_priority_target,
    l.needs_owner_contact AS listing_needs_owner_contact,
    ap.id AS admin_id,
    ap.first_name AS admin_first_name,
    ap.last_name AS admin_last_name,
    ap.email AS admin_email,
    bp.buyer_type AS buyer_type,
    COALESCE(bp.website, bp.buyer_org_url) AS buyer_website,
    bp.buyer_quality_score AS buyer_quality_score,
    bp.buyer_tier AS buyer_tier
  FROM public.deals d
  LEFT JOIN public.listings l ON l.id = d.listing_id
  LEFT JOIN public.deal_stages ds ON ds.id = d.stage_id
  LEFT JOIN public.profiles ap ON ap.id = d.assigned_to
  LEFT JOIN public.connection_requests cr ON cr.id = d.connection_request_id
  LEFT JOIN public.profiles bp ON bp.id = cr.user_id
  WHERE d.deleted_at IS NULL
    AND (
      d.connection_request_id IS NULL
      OR cr.status = 'approved'
    )
  ORDER BY d.created_at DESC;
$$;

COMMENT ON FUNCTION public.get_deals_with_buyer_profiles() IS
  'Returns all active deals with pre-joined listing, stage, admin, and buyer profile data. Eliminates the N+1 query pattern in the frontend use-deals hook.';
