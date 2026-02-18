-- Fix 3: Create RPC functions for scoring queue upserts
-- PostgREST .upsert() cannot target partial unique indexes (WHERE listing_id IS NOT NULL).
-- These RPCs use INSERT ... ON CONFLICT with the exact partial index predicate.

CREATE OR REPLACE FUNCTION public.upsert_deal_scoring_queue(
  p_universe_id uuid,
  p_listing_id uuid,
  p_score_type text,
  p_status text DEFAULT 'pending'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO remarketing_scoring_queue (universe_id, listing_id, score_type, status, created_at, updated_at)
  VALUES (p_universe_id, p_listing_id, p_score_type, p_status, now(), now())
  ON CONFLICT (universe_id, listing_id, score_type) WHERE listing_id IS NOT NULL
  DO UPDATE SET
    status = CASE 
      WHEN remarketing_scoring_queue.status IN ('pending', 'processing') THEN remarketing_scoring_queue.status
      ELSE EXCLUDED.status
    END,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_alignment_scoring_queue(
  p_universe_id uuid,
  p_buyer_id uuid,
  p_score_type text,
  p_status text DEFAULT 'pending'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO remarketing_scoring_queue (universe_id, buyer_id, score_type, status, created_at, updated_at)
  VALUES (p_universe_id, p_buyer_id, p_score_type, p_status, now(), now())
  ON CONFLICT (universe_id, buyer_id, score_type) WHERE buyer_id IS NOT NULL
  DO UPDATE SET
    status = CASE 
      WHEN remarketing_scoring_queue.status IN ('pending', 'processing') THEN remarketing_scoring_queue.status
      ELSE EXCLUDED.status
    END,
    updated_at = now();
END;
$$;

-- Grant execute to authenticated users (called from frontend via supabase.rpc)
GRANT EXECUTE ON FUNCTION public.upsert_deal_scoring_queue TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_alignment_scoring_queue TO authenticated;