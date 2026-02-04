-- Add zombie cleanup function for M&A guide generations
-- Mirrors the cleanup function for buyer_criteria_extractions

CREATE OR REPLACE FUNCTION cleanup_zombie_ma_guide_generations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE ma_guide_generations
  SET
    status = 'failed',
    error = 'Generation timed out after 10 minutes',
    completed_at = now(),
    updated_at = now()
  WHERE
    status = 'processing'
    AND started_at < now() - interval '10 minutes';

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  IF affected_count > 0 THEN
    RAISE NOTICE 'Marked % zombie guide generation(s) as failed', affected_count;
  END IF;

  RETURN affected_count;
END;
$$;

COMMENT ON FUNCTION cleanup_zombie_ma_guide_generations IS
  'Marks M&A guide generations stuck in processing status for >10 minutes as failed. Should be called periodically via cron job.';
