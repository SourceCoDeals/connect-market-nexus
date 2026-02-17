-- Add unique constraints for upsert support on scoring queue
CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_queue_deal
  ON public.remarketing_scoring_queue (universe_id, listing_id, score_type)
  WHERE listing_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_queue_alignment
  ON public.remarketing_scoring_queue (universe_id, buyer_id, score_type)
  WHERE buyer_id IS NOT NULL;