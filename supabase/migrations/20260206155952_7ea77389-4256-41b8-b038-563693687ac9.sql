DO $$
DECLARE
  dup_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO dup_ids
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY lower(trim(trailing '/' from replace(replace(website, 'https://', ''), 'http://', '')))
             ORDER BY 
               CASE WHEN enriched_at IS NOT NULL THEN 0 ELSE 1 END,
               CASE WHEN revenue IS NOT NULL AND revenue > 0 THEN 0 ELSE 1 END,
               created_at ASC
           ) as rn
    FROM listings
    WHERE website IS NOT NULL AND website != '' AND website != '<UNKNOWN>'
  ) sub
  WHERE rn > 1;

  IF dup_ids IS NOT NULL AND array_length(dup_ids, 1) > 0 THEN
    RAISE NOTICE 'Deleting % duplicate listings', array_length(dup_ids, 1);
    
    -- Delete ALL FK references
    DELETE FROM alert_delivery_logs WHERE listing_id = ANY(dup_ids);
    DELETE FROM buyer_approve_decisions WHERE listing_id = ANY(dup_ids);
    DELETE FROM buyer_learning_history WHERE listing_id = ANY(dup_ids);
    DELETE FROM buyer_pass_decisions WHERE listing_id = ANY(dup_ids);
    DELETE FROM chat_conversations WHERE listing_id = ANY(dup_ids);
    DELETE FROM collection_items WHERE listing_id = ANY(dup_ids);
    DELETE FROM connection_requests WHERE listing_id = ANY(dup_ids);
    DELETE FROM deal_ranking_history WHERE listing_id = ANY(dup_ids);
    DELETE FROM deal_referrals WHERE listing_id = ANY(dup_ids);
    DELETE FROM deals WHERE listing_id = ANY(dup_ids);
    DELETE FROM deal_scoring_adjustments WHERE listing_id = ANY(dup_ids);
    DELETE FROM deal_transcripts WHERE listing_id = ANY(dup_ids);
    DELETE FROM enrichment_queue WHERE listing_id = ANY(dup_ids);
    UPDATE inbound_leads SET mapped_to_listing_id = NULL WHERE mapped_to_listing_id = ANY(dup_ids);
    DELETE FROM listing_analytics WHERE listing_id = ANY(dup_ids);
    DELETE FROM listing_conversations WHERE listing_id = ANY(dup_ids);
    DELETE FROM outreach_records WHERE listing_id = ANY(dup_ids);
    DELETE FROM owner_intro_notifications WHERE listing_id = ANY(dup_ids);
    DELETE FROM remarketing_outreach WHERE listing_id = ANY(dup_ids);
    DELETE FROM remarketing_scores WHERE listing_id = ANY(dup_ids);
    DELETE FROM remarketing_universe_deals WHERE listing_id = ANY(dup_ids);
    DELETE FROM saved_listings WHERE listing_id = ANY(dup_ids);
    DELETE FROM similar_deal_alerts WHERE source_listing_id = ANY(dup_ids);
    DELETE FROM buyer_deal_scores WHERE deal_id::uuid = ANY(dup_ids);
    
    -- Delete the duplicates
    DELETE FROM listings WHERE id = ANY(dup_ids);
  END IF;
END $$;

-- Prevent future duplicates with a unique index on normalized website
CREATE UNIQUE INDEX idx_listings_unique_website 
ON listings (lower(trim(trailing '/' from replace(replace(website, 'https://', ''), 'http://', ''))))
WHERE website IS NOT NULL 
  AND website != '' 
  AND website != '<UNKNOWN>';