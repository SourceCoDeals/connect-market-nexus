-- Admin-only function to assign or correct decision admin for a connection request (supports legacy backfill)
CREATE OR REPLACE FUNCTION public.assign_connection_request_decider(
  p_request_id uuid,
  p_decision text,
  p_admin_id uuid,
  p_decision_at timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_id uuid;
  caller_is_admin boolean;
BEGIN
  -- Auth check
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Admin check
  SELECT is_admin INTO caller_is_admin FROM public.profiles WHERE id = caller_id;
  IF NOT COALESCE(caller_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can assign decision admins';
  END IF;

  -- Validate decision value
  IF p_decision NOT IN ('approved','rejected','on_hold','pending') THEN
    RAISE EXCEPTION 'Invalid decision value: %', p_decision;
  END IF;

  -- Handle reset to pending (clear all attribution)
  IF p_decision = 'pending' THEN
    UPDATE public.connection_requests
    SET 
      status = 'pending',
      decision_at = NULL,
      approved_by = NULL,
      approved_at = NULL,
      rejected_by = NULL,
      rejected_at = NULL,
      on_hold_by = NULL,
      on_hold_at = NULL,
      updated_at = NOW()
    WHERE id = p_request_id;
    RETURN FOUND;
  END IF;

  -- Assign the decision and admin attribution
  UPDATE public.connection_requests
  SET 
    status = p_decision,
    decision_at = COALESCE(p_decision_at, NOW()),
    approved_by = CASE WHEN p_decision = 'approved' THEN p_admin_id ELSE NULL END,
    approved_at = CASE WHEN p_decision = 'approved' THEN COALESCE(p_decision_at, NOW()) ELSE NULL END,
    rejected_by = CASE WHEN p_decision = 'rejected' THEN p_admin_id ELSE NULL END,
    rejected_at = CASE WHEN p_decision = 'rejected' THEN COALESCE(p_decision_at, NOW()) ELSE NULL END,
    on_hold_by = CASE WHEN p_decision = 'on_hold' THEN p_admin_id ELSE NULL END,
    on_hold_at = CASE WHEN p_decision = 'on_hold' THEN COALESCE(p_decision_at, NOW()) ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN FOUND;
END;
$$;