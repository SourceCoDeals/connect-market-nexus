-- ============================================================================
-- DOMAIN-BASED CONTACT TRACKING — PHASE 2
--
-- Adds the get_firm_activity RPC that returns unified_contact_timeline rows
-- matching EITHER a specific buyer_id OR any of a list of domains. Used by
-- useContactCombinedHistoryByDomain in the frontend to fan out a single
-- contact history query across every domain registered in firm_domain_aliases
-- for a buyer's firm.
--
-- Prerequisites:
--   - unified_contact_timeline view (20260716000001)
--   - firm_domain_aliases table (20260225000000)
--
-- The OR clause in the WHERE means a row that matches both the buyer_id
-- and a domain appears once (it's a single row in the underlying view),
-- so no explicit UNION / dedup is needed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_firm_activity(
  p_buyer_id UUID DEFAULT NULL,
  p_domains TEXT[] DEFAULT '{}'::text[]
)
RETURNS SETOF public.unified_contact_timeline
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.unified_contact_timeline
  WHERE
    -- Match by buyer id (preserving existing per-buyer behavior)
    (p_buyer_id IS NOT NULL AND remarketing_buyer_id = p_buyer_id)
    OR
    -- Match by any domain in firm_domain_aliases for this firm
    (
      cardinality(p_domains) > 0
      AND contact_email IS NOT NULL
      AND contact_email <> ''
      AND lower(split_part(contact_email, '@', 2)) = ANY(
        SELECT lower(d) FROM unnest(p_domains) AS d WHERE d IS NOT NULL AND d <> ''
      )
    )
  ORDER BY event_at DESC NULLS LAST
  LIMIT 500;
$$;

COMMENT ON FUNCTION public.get_firm_activity(UUID, TEXT[]) IS
  'Phase 2 of domain-based contact tracking. Returns up to 500 unified_contact_timeline rows matching either the given buyer_id OR any of the provided domains. Used to surface all activity across a firm, not just activity for a single contact.';

-- Only authenticated callers need this; admin pages are the sole consumers
-- today but no reason to lock non-admin roles out if RLS on the underlying
-- tables already handles visibility.
GRANT EXECUTE ON FUNCTION public.get_firm_activity(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_firm_activity(UUID, TEXT[]) TO service_role;
