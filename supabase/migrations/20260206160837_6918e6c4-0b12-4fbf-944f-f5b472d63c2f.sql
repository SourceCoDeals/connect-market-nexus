
-- First delete all FK references for the duplicate (b1b99800)
DELETE FROM alert_delivery_logs WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM buyer_approve_decisions WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM buyer_learning_history WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM buyer_pass_decisions WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM chat_conversations WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM collection_items WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM connection_requests WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM deal_ranking_history WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM deal_referrals WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM deals WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM deal_scoring_adjustments WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM deal_transcripts WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM enrichment_queue WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
UPDATE inbound_leads SET mapped_to_listing_id = NULL WHERE mapped_to_listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM listing_analytics WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM listing_conversations WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM outreach_records WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM owner_intro_notifications WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM remarketing_outreach WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM remarketing_scores WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM remarketing_universe_deals WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM saved_listings WHERE listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';
DELETE FROM similar_deal_alerts WHERE source_listing_id = 'b1b99800-b307-4528-9429-583ae222acf5';

-- Delete the duplicate
DELETE FROM listings WHERE id = 'b1b99800-b307-4528-9429-583ae222acf5';

-- Now safe to give the keeper the real website
UPDATE listings SET website = 'https://pro4mance.com/' WHERE id = 'afba67a3-1a53-415d-887f-56e63ef49d76';
