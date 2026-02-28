-- BUG-3 FIX: Advisory lock for queue processor mutual exclusion.
-- Prevents the TOCTOU race condition where two concurrent queue processor
-- invocations both see zero active items and both proceed to process.
--
-- Uses pg_try_advisory_lock with a deterministic lock ID derived from the
-- queue name. Returns true if the lock was acquired, false if another
-- session already holds it. The lock is automatically released when the
-- database session (connection) ends.
--
-- Note: Edge functions use short-lived connections from the Supabase
-- connection pool, so locks are automatically released when the function
-- finishes. This is the desired behavior — we only need the lock to
-- prevent overlapping invocations, not to hold it long-term.

CREATE OR REPLACE FUNCTION public.try_acquire_queue_processor_lock(
  p_queue_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lock_id bigint;
BEGIN
  -- Generate a deterministic lock ID from the queue name using hashtext.
  -- hashtext returns a 32-bit int; we cast to bigint for pg_try_advisory_lock.
  lock_id := hashtext('queue_processor:' || p_queue_name)::bigint;

  -- Try to acquire a session-level advisory lock (non-blocking).
  -- Returns true if acquired, false if another session already holds it.
  RETURN pg_try_advisory_lock(lock_id);
END;
$$;
