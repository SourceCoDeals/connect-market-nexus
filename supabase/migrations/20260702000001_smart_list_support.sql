-- Smart list support: auto-populating lists based on rules

-- 1. Add smart list columns to contact_lists
ALTER TABLE contact_lists
  ADD COLUMN IF NOT EXISTS is_smart_list BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS list_rules JSONB,
  ADD COLUMN IF NOT EXISTS match_mode TEXT DEFAULT 'all'
    CHECK (match_mode IN ('all', 'any')),
  ADD COLUMN IF NOT EXISTS source_entity TEXT
    CHECK (source_entity IS NULL OR source_entity IN ('listings', 'remarketing_buyers')),
  ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_add_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Track how members were added
ALTER TABLE contact_list_members
  ADD COLUMN IF NOT EXISTS added_by TEXT DEFAULT 'manual'
    CHECK (added_by IN ('manual', 'smart_rule', 'import'));

-- 3. Indexes for smart list queries
CREATE INDEX IF NOT EXISTS idx_cl_smart_active
  ON contact_lists (is_smart_list, source_entity)
  WHERE is_smart_list = TRUE AND is_archived = FALSE AND auto_add_enabled = TRUE;

-- 4. Evaluation queue for seller smart lists (listings)
CREATE TABLE IF NOT EXISTS smart_list_evaluation_queue (
  listing_id UUID NOT NULL PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Evaluation queue for buyer smart lists
CREATE TABLE IF NOT EXISTS smart_list_buyer_evaluation_queue (
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id)
);

-- 6. RLS on queue tables (service role only — processed by edge function)
ALTER TABLE smart_list_evaluation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_list_buyer_evaluation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on seller queue"
  ON smart_list_evaluation_queue FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on buyer queue"
  ON smart_list_buyer_evaluation_queue FOR ALL
  USING (true) WITH CHECK (true);

-- 7. Trigger: queue listings for smart list evaluation on insert/update
CREATE OR REPLACE FUNCTION public.queue_smart_list_evaluation()
RETURNS trigger AS $$
BEGIN
  -- Only queue if smart seller lists exist
  IF EXISTS (
    SELECT 1 FROM contact_lists
    WHERE is_smart_list = TRUE AND is_archived = FALSE
      AND auto_add_enabled = TRUE AND source_entity = 'listings'
    LIMIT 1
  ) THEN
    INSERT INTO smart_list_evaluation_queue (listing_id, queued_at)
    VALUES (NEW.id, now())
    ON CONFLICT (listing_id) DO UPDATE SET queued_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_smart_list_on_listing_insert
  AFTER INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION queue_smart_list_evaluation();

CREATE TRIGGER trg_smart_list_on_listing_update
  AFTER UPDATE OF industry, category, address_state, linkedin_employee_count,
    google_review_count, google_rating, number_of_locations, deal_total_score,
    enriched_at, main_contact_email, main_contact_phone, services, categories,
    executive_summary, service_mix, is_priority_target, deal_source
  ON listings
  FOR EACH ROW
  WHEN (OLD IS DISTINCT FROM NEW)
  EXECUTE FUNCTION queue_smart_list_evaluation();

-- 8. Trigger: queue buyers for smart list evaluation
CREATE OR REPLACE FUNCTION public.queue_smart_list_buyer_evaluation()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM contact_lists
    WHERE is_smart_list = TRUE AND is_archived = FALSE
      AND auto_add_enabled = TRUE AND source_entity = 'remarketing_buyers'
    LIMIT 1
  ) THEN
    INSERT INTO smart_list_buyer_evaluation_queue (buyer_id, queued_at)
    VALUES (NEW.id, now())
    ON CONFLICT (buyer_id) DO UPDATE SET queued_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_smart_list_on_buyer_insert
  AFTER INSERT ON buyers
  FOR EACH ROW EXECUTE FUNCTION queue_smart_list_buyer_evaluation();

CREATE TRIGGER trg_smart_list_on_buyer_update
  AFTER UPDATE OF target_services, target_geographies, buyer_type,
    is_pe_backed, hq_state
  ON buyers
  FOR EACH ROW
  WHEN (OLD IS DISTINCT FROM NEW)
  EXECUTE FUNCTION queue_smart_list_buyer_evaluation();

-- 9. RPC to manually trigger evaluation for a single smart list
CREATE OR REPLACE FUNCTION public.evaluate_smart_list_now(p_list_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_list record;
  v_count int := 0;
  v_rules jsonb;
  v_match_mode text;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can evaluate smart lists';
  END IF;

  SELECT * INTO v_list FROM contact_lists WHERE id = p_list_id AND is_smart_list = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Smart list not found';
  END IF;

  -- For seller lists, queue all active listings for evaluation
  IF v_list.source_entity = 'listings' THEN
    INSERT INTO smart_list_evaluation_queue (listing_id, queued_at)
    SELECT id, now() FROM listings
    WHERE deleted_at IS NULL
      AND (not_a_fit = false OR not_a_fit IS NULL)
      AND main_contact_email IS NOT NULL
    ON CONFLICT (listing_id) DO UPDATE SET queued_at = now();

    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSIF v_list.source_entity = 'remarketing_buyers' THEN
    INSERT INTO smart_list_buyer_evaluation_queue (buyer_id, queued_at)
    SELECT id, now() FROM buyers
    WHERE archived = false AND deleted_at IS NULL
    ON CONFLICT (buyer_id) DO UPDATE SET queued_at = now();

    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  UPDATE contact_lists SET last_evaluated_at = now() WHERE id = p_list_id;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION evaluate_smart_list_now IS 'Queue all entities for smart list re-evaluation';
