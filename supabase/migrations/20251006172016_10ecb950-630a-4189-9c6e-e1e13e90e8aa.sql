-- Fix the buyer_priority_score trigger to handle NULL user_id gracefully
CREATE OR REPLACE FUNCTION public.update_buyer_priority_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  buyer_type_value text;
BEGIN
  -- Only calculate if user_id is present
  IF NEW.user_id IS NOT NULL THEN
    -- Get buyer type from the user's profile
    SELECT p.buyer_type INTO buyer_type_value
    FROM public.profiles p
    WHERE p.id = NEW.user_id;
    
    -- Calculate and update priority score
    NEW.buyer_priority_score := public.calculate_buyer_priority_score(COALESCE(buyer_type_value, ''));
  ELSE
    -- Set default score for requests without user_id (lead requests)
    NEW.buyer_priority_score := 0;
  END IF;
  
  RETURN NEW;
END;
$$;