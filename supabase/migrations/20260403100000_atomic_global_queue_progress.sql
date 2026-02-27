-- BUG-6 FIX: Atomic increment for global_activity_queue progress counters.
-- Prevents lost updates when multiple concurrent queue processors call
-- updateGlobalQueueProgress at the same time (e.g., deal enrichment
-- processes 5 items in parallel, all incrementing completed_items).
--
-- Before: read-modify-write (SELECT completed_items, then UPDATE completed_items = old + 1)
-- After:  single atomic UPDATE with SQL increment (completed_items = completed_items + delta)

CREATE OR REPLACE FUNCTION public.increment_global_queue_progress(
  p_operation_type text,
  p_completed_delta integer DEFAULT 0,
  p_failed_delta integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE global_activity_queue
  SET
    completed_items = COALESCE(completed_items, 0) + p_completed_delta,
    failed_items = COALESCE(failed_items, 0) + p_failed_delta
  WHERE operation_type = p_operation_type
    AND status = 'running';
END;
$$;
