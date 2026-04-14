-- ============================================================================
-- DOMAIN-BASED CONTACT TRACKING — PHASE 5: BATCH FIRM TOUCHPOINT COUNTS
--
-- Adds get_firm_touchpoint_counts(p_buyer_ids uuid[]) — a batch RPC that
-- returns per-buyer totals combining:
--
--   (a) activity rows in unified_contact_timeline matching the buyer id
--       directly (remarketing_buyer_id = buyer.id), AND
--   (b) activity rows whose contact_email domain matches any entry in
--       firm_domain_aliases for the buyer's marketplace_firm_id.
--
-- This is the batch version of the logic the Phase 2 RPC
-- get_firm_activity(p_buyer_id, p_domains) runs for a single buyer. We
-- expose a dedicated batch function because the deal matching page needs
-- counts for ~50 buyers per matching run — invoking the single-buyer RPC
-- that many times would be expensive and chatty. This one query returns
-- all counts in one round-trip.
--
-- De-dup semantics: a row that matches both the buyer id and the domain
-- set is counted once per buyer (UNION via a distinct timeline_id
-- subquery) — otherwise firms with a direct buyer match would double-
-- count every touchpoint.
--
-- Prerequisites:
--   - firm_domain_aliases   (20260225000000)
--   - unified_contact_timeline view (20260716000001)
--   - buyers.marketplace_firm_id column (pre-existing)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_firm_touchpoint_counts(
  p_buyer_ids UUID[]
)
RETURNS TABLE (
  buyer_id UUID,
  firm_touchpoint_count BIGINT,
  firm_domain_count INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  -- Each buyer's list of firm alias domains, lowercased. When a buyer has
  -- no marketplace_firm_id or no aliases the set is empty and only the
  -- buyer-id branch contributes to the count (backward-compatible with
  -- the pre-domain behavior).
  buyer_domains AS (
    SELECT
      b.id AS buyer_id,
      COALESCE(
        array_agg(lower(fda.domain)) FILTER (WHERE fda.domain IS NOT NULL),
        ARRAY[]::TEXT[]
      ) AS domains
    FROM public.buyers b
    LEFT JOIN public.firm_domain_aliases fda ON fda.firm_id = b.marketplace_firm_id
    WHERE b.id = ANY(p_buyer_ids)
    GROUP BY b.id
  ),
  -- One row per (buyer, timeline_id) via a DISTINCT union of the two
  -- match branches. Distinct on timeline_id within each buyer prevents
  -- double-counting a single timeline row that satisfies both branches.
  touchpoints AS (
    SELECT DISTINCT bd.buyer_id, uct.id AS timeline_id
    FROM buyer_domains bd
    JOIN public.unified_contact_timeline uct ON (
      uct.remarketing_buyer_id = bd.buyer_id
      OR (
        cardinality(bd.domains) > 0
        AND uct.contact_email IS NOT NULL
        AND uct.contact_email <> ''
        AND lower(split_part(uct.contact_email, '@', 2)) = ANY(bd.domains)
      )
    )
  )
  SELECT
    bd.buyer_id,
    COALESCE(COUNT(tp.timeline_id), 0) AS firm_touchpoint_count,
    cardinality(bd.domains) AS firm_domain_count
  FROM buyer_domains bd
  LEFT JOIN touchpoints tp ON tp.buyer_id = bd.buyer_id
  GROUP BY bd.buyer_id, bd.domains;
$$;

COMMENT ON FUNCTION public.get_firm_touchpoint_counts(UUID[]) IS
  'Phase 5 of domain-based contact tracking. Batch version of get_firm_activity — returns per-buyer firm touchpoint counts for every id in p_buyer_ids. Used by the deal matching page to display a "firm touchpoints" metric on each buyer card without firing one RPC per card.';

GRANT EXECUTE ON FUNCTION public.get_firm_touchpoint_counts(UUID[])
  TO authenticated, service_role;
