
-- Create admin-only RPC to reset failed enrichment queue items
CREATE OR REPLACE FUNCTION public.reset_failed_enrichments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Only allow admins
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  UPDATE buyer_enrichment_queue 
  SET status = 'pending', attempts = 0, last_error = NULL, force = true, updated_at = now()
  WHERE status = 'failed';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
