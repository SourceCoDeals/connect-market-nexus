-- Create a simplified status update function without mandatory decision notes
CREATE OR REPLACE FUNCTION public.update_connection_request_status_simple(request_id uuid, new_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SELECT profiles.is_admin INTO admin_is_admin FROM public.profiles WHERE profiles.id = admin_user_id;
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update connection requests';
  END IF;

  -- Validate status
  IF new_status NOT IN ('pending','approved','rejected','on_hold') THEN
    RAISE EXCEPTION 'Invalid status value: %', new_status;
  END IF;

  -- Update with proper attribution and timestamps (no mandatory notes)
  UPDATE public.connection_requests
  SET 
    status = new_status,
    updated_at = NOW(),
    decision_at = CASE WHEN new_status IN ('approved','rejected','on_hold') THEN NOW() ELSE NULL END,
    approved_by = CASE WHEN new_status = 'approved' THEN admin_user_id ELSE NULL END,
    approved_at = CASE WHEN new_status = 'approved' THEN NOW() ELSE NULL END,
    rejected_by = CASE WHEN new_status = 'rejected' THEN admin_user_id ELSE NULL END,
    rejected_at = CASE WHEN new_status = 'rejected' THEN NOW() ELSE NULL END,
    on_hold_by = CASE WHEN new_status = 'on_hold' THEN admin_user_id ELSE NULL END,
    on_hold_at = CASE WHEN new_status = 'on_hold' THEN NOW() ELSE NULL END
  WHERE connection_requests.id = request_id;

  RETURN FOUND;
END;
$function$;

-- Create function to update decision notes separately
CREATE OR REPLACE FUNCTION public.update_connection_request_notes(request_id uuid, notes text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SELECT profiles.is_admin INTO admin_is_admin FROM public.profiles WHERE profiles.id = admin_user_id;
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update connection request notes';
  END IF;

  -- Update notes
  UPDATE public.connection_requests
  SET 
    decision_notes = notes,
    updated_at = NOW()
  WHERE connection_requests.id = request_id;

  RETURN FOUND;
END;
$function$;