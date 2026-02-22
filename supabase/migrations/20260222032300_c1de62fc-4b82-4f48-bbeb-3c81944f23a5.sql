-- ============================================================================
-- FIX: delete_listing_cascade — stale function with 2 bugs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_listing_cascade(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can delete listings';
  END IF;

  -- Delete all related records in dependency order
  DELETE FROM public.marketplace_approval_queue WHERE deal_id = p_listing_id;
  DELETE FROM public.deal_data_room_access WHERE deal_id = p_listing_id;
  DELETE FROM public.document_release_log WHERE deal_id = p_listing_id;
  DELETE FROM public.document_tracked_links WHERE deal_id = p_listing_id;
  DELETE FROM public.deal_documents WHERE deal_id = p_listing_id;

  DELETE FROM public.data_room_audit_log WHERE deal_id = p_listing_id;
  DELETE FROM public.data_room_access WHERE deal_id = p_listing_id;
  DELETE FROM public.data_room_documents WHERE deal_id = p_listing_id;

  DELETE FROM public.memo_distribution_log WHERE deal_id = p_listing_id;
  DELETE FROM public.lead_memo_versions WHERE memo_id IN (
    SELECT id FROM public.lead_memos WHERE deal_id = p_listing_id
  );
  DELETE FROM public.lead_memos WHERE deal_id = p_listing_id;

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
  DELETE FROM public.listing_analytics WHERE listing_id = p_listing_id;
  DELETE FROM public.listing_conversations WHERE listing_id = p_listing_id;
  DELETE FROM public.outreach_records WHERE listing_id = p_listing_id;
  DELETE FROM public.owner_intro_notifications WHERE listing_id = p_listing_id;
  DELETE FROM public.remarketing_outreach WHERE listing_id = p_listing_id;
  DELETE FROM public.remarketing_scores WHERE listing_id = p_listing_id;
  DELETE FROM public.remarketing_scoring_queue WHERE listing_id = p_listing_id;
  DELETE FROM public.remarketing_universe_deals WHERE listing_id = p_listing_id;
  DELETE FROM public.saved_listings WHERE listing_id = p_listing_id;
  DELETE FROM public.similar_deal_alerts WHERE source_listing_id = p_listing_id;
  DELETE FROM public.score_snapshots WHERE listing_id = p_listing_id;

  UPDATE public.inbound_leads SET mapped_to_listing_id = NULL WHERE mapped_to_listing_id = p_listing_id;
  UPDATE public.valuation_leads SET pushed_listing_id = NULL WHERE pushed_listing_id = p_listing_id;

  DELETE FROM public.listings WHERE id = p_listing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_listing_cascade(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_listing_cascade(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_listing_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_listing_cascade(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_listing_cascade(uuid) TO postgres;