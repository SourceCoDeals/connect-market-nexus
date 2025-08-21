-- Add on-hold attribution columns and RPC for atomic status updates with admin attribution
-- 1) Columns
ALTER TABLE public.connection_requests
  ADD COLUMN IF NOT EXISTS on_hold_by uuid NULL,
  ADD COLUMN IF NOT EXISTS on_hold_at timestamptz NULL;

-- 2) RPC: update_connection_request_status
CREATE OR REPLACE FUNCTION public.update_connection_request_status(
  request_id uuid,
  new_status text,
  admin_notes text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  -- Auth check
  admin_user_id := auth.uid();
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Admin check
  SELECT is_admin INTO admin_is_admin FROM public.profiles WHERE id = admin_user_id;
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update connection requests';
  END IF;

  -- Validate status
  IF new_status NOT IN ('pending','approved','rejected','on_hold') THEN
    RAISE EXCEPTION 'Invalid status value: %', new_status;
  END IF;

  -- Update with proper attribution and timestamps
  UPDATE public.connection_requests
  SET 
    status = new_status,
    updated_at = NOW(),
    decision_at = CASE WHEN new_status IN ('approved','rejected') THEN NOW() ELSE NULL END,
    approved_by = CASE WHEN new_status = 'approved' THEN admin_user_id ELSE NULL END,
    approved_at = CASE WHEN new_status = 'approved' THEN NOW() ELSE NULL END,
    rejected_by = CASE WHEN new_status = 'rejected' THEN admin_user_id ELSE NULL END,
    rejected_at = CASE WHEN new_status = 'rejected' THEN NOW() ELSE NULL END,
    on_hold_by = CASE WHEN new_status = 'on_hold' THEN admin_user_id ELSE NULL END,
    on_hold_at = CASE WHEN new_status = 'on_hold' THEN NOW() ELSE NULL END
  WHERE id = request_id;

  RETURN FOUND;
END;
$$;