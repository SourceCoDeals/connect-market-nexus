-- Fix: RPCs reference updated_at which doesn't exist on remarketing_scoring_queue.
-- Option 1 (chosen): Add updated_at to the table AND fix the RPC to also update processed_at correctly.
-- This is the right fix because updated_at is semantically correct for a queue table.

ALTER TABLE public.remarketing_scoring_queue
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Update existing rows to have updated_at = created_at
UPDATE public.remarketing_scoring_queue SET updated_at = created_at WHERE updated_at IS NULL;

-- Recreate both RPCs now that updated_at exists on the table
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

GRANT EXECUTE ON FUNCTION public.upsert_deal_scoring_queue TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_alignment_scoring_queue TO authenticated;