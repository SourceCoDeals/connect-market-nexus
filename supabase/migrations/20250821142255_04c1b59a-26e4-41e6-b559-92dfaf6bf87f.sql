-- Add decision notes to connection requests and create user notes table

-- Add decision notes column to connection_requests
ALTER TABLE public.connection_requests 
ADD COLUMN decision_notes text;

-- Create user_notes table for cross-request sharing
CREATE TABLE public.user_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  note_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on user_notes table
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for user_notes
CREATE POLICY "Admins can view all user notes" 
ON public.user_notes 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert user notes" 
ON public.user_notes 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()) AND auth.uid() = admin_id);

CREATE POLICY "Admins can update their own user notes" 
ON public.user_notes 
FOR UPDATE 
USING (is_admin(auth.uid()) AND auth.uid() = admin_id);

CREATE POLICY "Admins can delete their own user notes" 
ON public.user_notes 
FOR DELETE 
USING (is_admin(auth.uid()) AND auth.uid() = admin_id);

-- Create function to update connection request status with required decision notes
CREATE OR REPLACE FUNCTION public.update_connection_request_status_with_notes(
  request_id uuid, 
  new_status text, 
  decision_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

  -- Require decision notes for non-pending statuses
  IF new_status != 'pending' AND (decision_notes IS NULL OR trim(decision_notes) = '') THEN
    RAISE EXCEPTION 'Decision notes are required when changing status to %', new_status;
  END IF;

  -- Update with proper attribution and timestamps
  UPDATE public.connection_requests
  SET 
    status = new_status,
    decision_notes = CASE WHEN new_status != 'pending' THEN decision_notes ELSE NULL END,
    updated_at = NOW(),
    decision_at = CASE WHEN new_status IN ('approved','rejected','on_hold') THEN NOW() ELSE NULL END,
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