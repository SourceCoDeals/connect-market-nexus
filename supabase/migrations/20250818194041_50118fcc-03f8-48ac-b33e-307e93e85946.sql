-- Create negative follow-up tracking for connection_requests table
ALTER TABLE public.connection_requests 
ADD COLUMN IF NOT EXISTS negative_followed_up BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS negative_followed_up_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS negative_followed_up_by UUID REFERENCES auth.users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_connection_requests_negative_followed_up ON public.connection_requests(negative_followed_up);

-- Create function to update negative follow-up status
CREATE OR REPLACE FUNCTION public.update_connection_request_negative_followup(
  request_id uuid,
  is_followed_up boolean,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  -- Get current authenticated user ID
  admin_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Check if the calling user is an admin
  SELECT is_admin INTO admin_is_admin 
  FROM public.profiles 
  WHERE id = admin_user_id;
  
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update negative follow-up status';
  END IF;
  
  -- Update the connection request
  UPDATE public.connection_requests 
  SET 
    negative_followed_up = is_followed_up,
    negative_followed_up_at = CASE 
      WHEN is_followed_up THEN NOW() 
      ELSE NULL 
    END,
    negative_followed_up_by = CASE 
      WHEN is_followed_up THEN admin_user_id 
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = request_id;
  
  RETURN FOUND;
END;
$$;