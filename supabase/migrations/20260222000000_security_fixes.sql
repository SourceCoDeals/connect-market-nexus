-- ============================================================================
-- SECURITY FIXES: Phase 0 — Critical vulnerabilities from platform audit
--
-- Fixes:
--   N03: RLS policy missing is_internal_deal = false check
--   N05: Bulk delete cascade stored procedure (replaces 27 sequential calls)
--
-- These are the database-level security fixes identified in AUDIT_RECONCILIATION.md
-- ============================================================================


-- ─── FIX N03: Add is_internal_deal enforcement to RLS policy ───
-- The existing policy (from 20251006114111) checks status, deleted_at, and
-- buyer_type but does NOT check is_internal_deal. This allows authenticated
-- buyers to query internal/remarketing deals directly via the Supabase JS client.

-- Drop and recreate the policy with the is_internal_deal check
DROP POLICY IF EXISTS "Approved users can view active listings based on buyer type" ON public.listings;

CREATE POLICY "Approved users can view active listings based on buyer type"
ON public.listings
FOR SELECT
TO authenticated
USING (
  -- Admins can see everything (including internal deals)
  is_admin(auth.uid())
  OR
  -- Regular approved users can only see NON-INTERNAL, active, non-deleted listings
  (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND approval_status = 'approved'
        AND email_verified = true
    )
    AND status = 'active'
    AND deleted_at IS NULL
    AND is_internal_deal = false  -- N03 FIX: Prevent marketplace buyers from seeing internal deals
    AND (
      -- Listing is visible to all (NULL or empty array)
      visible_to_buyer_types IS NULL
      OR array_length(visible_to_buyer_types, 1) IS NULL
      OR
      -- OR user's buyer_type is in the allowed list
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND buyer_type = ANY(listings.visible_to_buyer_types)
      )
    )
  )
);

COMMENT ON POLICY "Approved users can view active listings based on buyer type" ON public.listings IS
'Marketplace RLS: Admins see all. Regular users see active, non-deleted, non-internal listings matching their buyer_type. Fixed in security audit to enforce is_internal_deal = false.';


-- ─── FIX N05: Bulk delete cascade stored procedure ───
-- Replaces 27 sequential client-side DELETE calls with a single RPC call.
-- Deleting 10 deals goes from 270 round trips to 10.

CREATE OR REPLACE FUNCTION public.delete_listing_cascade(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can execute this function
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can delete listings';
  END IF;

  -- Delete all related records in dependency order
  -- Child tables with listing_id FK
  DELETE FROM public.alert_delivery_logs WHERE listing_id = p_listing_id;
  DELETE FROM public.buyer_approve_decisions WHERE listing_id = p_listing_id;
  DELETE FROM public.buyer_learning_history WHERE listing_id = p_listing_id;
  DELETE FROM public.buyer_pass_decisions WHERE listing_id = p_listing_id;
  DELETE FROM public.buyer_deal_scores WHERE deal_id = p_listing_id::text;
  DELETE FROM public.call_transcripts WHERE listing_id = p_listing_id;
  DELETE FROM public.chat_conversations WHERE listing_id = p_listing_id;
  DELETE FROM public.collection_items WHERE listing_id = p_listing_id;
  DELETE FROM public.connection_requests WHERE listing_id = p_listing_id;
  DELETE FROM public.deal_ranking_history WHERE listing_id = p_listing_id;
  DELETE FROM public.deal_referrals WHERE listing_id = p_listing_id;
  DELETE FROM public.deals WHERE listing_id = p_listing_id;
  DELETE FROM public.deal_scoring_adjustments WHERE listing_id = p_listing_id;
  DELETE FROM public.deal_transcripts WHERE listing_id = p_listing_id;
  DELETE FROM public.engagement_signals WHERE listing_id = p_listing_id;
  DELETE FROM public.enrichment_queue WHERE listing_id = p_listing_id;
  DELETE FROM public.interest_signals WHERE listing_id = p_listing_id;
  DELETE FROM public.listing_analytics WHERE listing_id = p_listing_id;
  DELETE FROM public.listing_conversations WHERE listing_id = p_listing_id;
  DELETE FROM public.listing_personal_notes WHERE listing_id = p_listing_id;
  DELETE FROM public.outreach_records WHERE listing_id = p_listing_id;
  DELETE FROM public.owner_intro_notifications WHERE listing_id = p_listing_id;
  DELETE FROM public.remarketing_outreach WHERE listing_id = p_listing_id;
  DELETE FROM public.remarketing_scores WHERE listing_id = p_listing_id;
  DELETE FROM public.remarketing_scoring_queue WHERE listing_id = p_listing_id;
  DELETE FROM public.remarketing_universe_deals WHERE listing_id = p_listing_id;
  DELETE FROM public.saved_listings WHERE listing_id = p_listing_id;
  DELETE FROM public.similar_deal_alerts WHERE source_listing_id = p_listing_id;
  DELETE FROM public.score_snapshots WHERE listing_id = p_listing_id;
  -- Nullify FK references that shouldn't cascade-delete the referencing row
  UPDATE public.inbound_leads SET mapped_to_listing_id = NULL WHERE mapped_to_listing_id = p_listing_id;
  UPDATE public.valuation_leads SET pushed_listing_id = NULL WHERE pushed_listing_id = p_listing_id;
  -- Finally delete the listing itself
  DELETE FROM public.listings WHERE id = p_listing_id;
END;
$$;

-- Revoke from anonymous, grant to authenticated (admin check is inside the function)
REVOKE ALL ON FUNCTION public.delete_listing_cascade(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_listing_cascade(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_listing_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_listing_cascade(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_listing_cascade(uuid) TO postgres;


-- ============================================================================
-- Summary:
--   1. RLS policy now enforces is_internal_deal = false for non-admin users
--   2. delete_listing_cascade() replaces 27 sequential client DELETE calls
--   Both fixes are idempotent and safe to run multiple times.
-- ============================================================================
