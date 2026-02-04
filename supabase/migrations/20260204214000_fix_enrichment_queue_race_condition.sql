-- Fix enrichment queue race condition using FOR UPDATE SKIP LOCKED
-- Ensures multiple workers don't process the same queue item

-- ============= ATOMIC QUEUE CLAIM FUNCTION =============

/**
 * Atomically claim the next enrichment queue item for processing
 *
 * This function uses FOR UPDATE SKIP LOCKED to prevent race conditions.
 * Multiple workers can safely call this function concurrently.
 *
 * Returns:
 * - The claimed queue item (status changed to 'processing')
 * - NULL if no items available
 */
CREATE OR REPLACE FUNCTION claim_next_enrichment_item()
RETURNS TABLE(
  id uuid,
  listing_id uuid,
  enrichment_type text,
  priority integer,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  claimed_item enrichment_queue%ROWTYPE;
BEGIN
  -- Atomically select and lock the highest priority pending item
  -- SKIP LOCKED ensures we skip items already locked by other workers
  SELECT *
  INTO claimed_item
  FROM enrichment_queue
  WHERE status = 'pending'
  ORDER BY
    priority DESC,      -- Higher priority first
    created_at ASC      -- FIFO within same priority
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no item found, return NULL
  IF claimed_item.id IS NULL THEN
    RETURN;
  END IF;

  -- Update the item to 'processing' status
  UPDATE enrichment_queue
  SET
    status = 'processing',
    started_at = now(),
    updated_at = now()
  WHERE enrichment_queue.id = claimed_item.id;

  -- Return the claimed item
  RETURN QUERY
  SELECT
    claimed_item.id,
    claimed_item.listing_id,
    claimed_item.enrichment_type,
    claimed_item.priority,
    claimed_item.metadata,
    claimed_item.created_at;
END;
$$;

COMMENT ON FUNCTION claim_next_enrichment_item IS
  'Atomically claim next enrichment queue item using FOR UPDATE SKIP LOCKED. Safe for concurrent workers. Returns NULL if queue is empty.';

-- ============= BATCH CLAIM FUNCTION =============

/**
 * Atomically claim multiple enrichment queue items for batch processing
 *
 * @param batch_size - Number of items to claim (default 10)
 * @param enrichment_type_filter - Optional filter for specific enrichment type
 */
CREATE OR REPLACE FUNCTION claim_enrichment_batch(
  batch_size integer DEFAULT 10,
  enrichment_type_filter text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  listing_id uuid,
  enrichment_type text,
  priority integer,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  claimed_ids uuid[];
BEGIN
  -- Atomically select and lock multiple items
  SELECT array_agg(eq.id)
  INTO claimed_ids
  FROM (
    SELECT id
    FROM enrichment_queue
    WHERE
      status = 'pending'
      AND (enrichment_type_filter IS NULL OR enrichment_type = enrichment_type_filter)
    ORDER BY
      priority DESC,
      created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ) eq;

  -- If no items found, return empty
  IF claimed_ids IS NULL OR array_length(claimed_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Update all claimed items to 'processing'
  UPDATE enrichment_queue
  SET
    status = 'processing',
    started_at = now(),
    updated_at = now()
  WHERE id = ANY(claimed_ids);

  -- Return the claimed items
  RETURN QUERY
  SELECT
    eq.id,
    eq.listing_id,
    eq.enrichment_type,
    eq.priority,
    eq.metadata,
    eq.created_at
  FROM enrichment_queue eq
  WHERE eq.id = ANY(claimed_ids)
  ORDER BY
    eq.priority DESC,
    eq.created_at ASC;
END;
$$;

COMMENT ON FUNCTION claim_enrichment_batch IS
  'Atomically claim batch of enrichment items. Useful for parallel batch processing. Safe for concurrent workers.';

-- ============= RELEASE ITEM FUNCTION =============

/**
 * Release a claimed enrichment item back to pending (e.g., on worker failure)
 *
 * @param item_id - ID of the item to release
 */
CREATE OR REPLACE FUNCTION release_enrichment_item(item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE enrichment_queue
  SET
    status = 'pending',
    started_at = NULL,
    updated_at = now()
  WHERE
    id = item_id
    AND status = 'processing';

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN updated_count > 0;
END;
$$;

COMMENT ON FUNCTION release_enrichment_item IS
  'Release a processing item back to pending. Use when worker fails before completing enrichment.';

-- ============= COMPLETE ITEM FUNCTION =============

/**
 * Mark enrichment item as completed
 *
 * @param item_id - ID of the item to complete
 * @param result_data - Optional result data to store
 */
CREATE OR REPLACE FUNCTION complete_enrichment_item(
  item_id uuid,
  result_data jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE enrichment_queue
  SET
    status = 'completed',
    completed_at = now(),
    updated_at = now(),
    result = result_data
  WHERE
    id = item_id
    AND status = 'processing';

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN updated_count > 0;
END;
$$;

COMMENT ON FUNCTION complete_enrichment_item IS
  'Mark enrichment item as completed. Only succeeds if item is currently processing.';

-- ============= FAIL ITEM FUNCTION =============

/**
 * Mark enrichment item as failed
 *
 * @param item_id - ID of the item that failed
 * @param error_message - Error description
 * @param should_retry - Whether to retry (increments error_count)
 */
CREATE OR REPLACE FUNCTION fail_enrichment_item(
  item_id uuid,
  error_message text,
  should_retry boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer;
  current_error_count integer;
  max_retries integer := 3;
BEGIN
  -- Get current error count
  SELECT error_count INTO current_error_count
  FROM enrichment_queue
  WHERE id = item_id;

  IF should_retry AND current_error_count < max_retries THEN
    -- Retry: increment error count and reset to pending
    UPDATE enrichment_queue
    SET
      status = 'pending',
      error_count = error_count + 1,
      last_error = error_message,
      started_at = NULL,
      updated_at = now()
    WHERE
      id = item_id
      AND status = 'processing';
  ELSE
    -- Failed permanently
    UPDATE enrichment_queue
    SET
      status = 'failed',
      error_count = error_count + 1,
      last_error = error_message,
      completed_at = now(),
      updated_at = now()
    WHERE
      id = item_id
      AND status = 'processing';
  END IF;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN updated_count > 0;
END;
$$;

COMMENT ON FUNCTION fail_enrichment_item IS
  'Mark enrichment item as failed. Optionally retry up to 3 times before permanent failure.';

-- ============= ZOMBIE CLEANUP FUNCTION =============

/**
 * Clean up enrichment items stuck in 'processing' status
 * Items processing for >10 minutes are reset to pending
 */
CREATE OR REPLACE FUNCTION cleanup_zombie_enrichment_items()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE enrichment_queue
  SET
    status = 'pending',
    error_count = error_count + 1,
    last_error = 'Processing timeout - reset to pending by zombie cleanup',
    started_at = NULL,
    updated_at = now()
  WHERE
    status = 'processing'
    AND started_at < now() - interval '10 minutes';

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  IF affected_count > 0 THEN
    RAISE NOTICE 'Reset % zombie enrichment item(s) to pending', affected_count;
  END IF;

  RETURN affected_count;
END;
$$;

COMMENT ON FUNCTION cleanup_zombie_enrichment_items IS
  'Clean up enrichment items stuck in processing for >10 minutes. Should be called periodically via cron.';

-- ============= QUEUE STATISTICS VIEW =============

CREATE OR REPLACE VIEW enrichment_queue_stats AS
SELECT
  enrichment_type,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, now()) - created_at))) as avg_duration_seconds,
  MAX(EXTRACT(EPOCH FROM (COALESCE(completed_at, now()) - created_at))) as max_duration_seconds,
  AVG(error_count) as avg_error_count
FROM enrichment_queue
GROUP BY enrichment_type, status
ORDER BY enrichment_type, status;

COMMENT ON VIEW enrichment_queue_stats IS
  'Statistics on enrichment queue by type and status. Use for monitoring queue health.';

-- ============= ADD CRON JOB FOR ZOMBIE CLEANUP =============

-- Schedule zombie cleanup every 5 minutes
SELECT cron.schedule(
  'cleanup-zombie-enrichment-items',
  '*/5 * * * *',
  $$SELECT cleanup_zombie_enrichment_items();$$
);
