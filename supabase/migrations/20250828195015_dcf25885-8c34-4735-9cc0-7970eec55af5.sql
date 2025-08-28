-- Phase 2: Cleanup phantom users and implement signup linking

-- Step 1: Convert Sam's request to lead-only (remove phantom user linkage)
UPDATE public.connection_requests 
SET user_id = NULL,
    source_metadata = COALESCE(source_metadata, '{}'::jsonb) || jsonb_build_object(
      'converted_to_lead_only', true,
      'phantom_user_removed', true,
      'cleanup_date', now()
    )
WHERE user_id = '732602de-a1e1-414c-b71d-613ac167008b'
  AND lead_email = 'sam@spventures.io';

-- Step 2: Remove the phantom user account
-- First remove from profiles (this will cascade to auth.users via trigger)
DELETE FROM public.profiles 
WHERE id = '732602de-a1e1-414c-b71d-613ac167008b' 
  AND email = 'sam@spventures.io'
  AND company = 'The pave';

-- Step 3: Create a function to link lead-only requests when users sign up
CREATE OR REPLACE FUNCTION public.link_lead_requests_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- When a new profile is created (user signup), check for existing lead-only requests
  -- and silently link them to the new user account
  UPDATE public.connection_requests 
  SET 
    user_id = NEW.id,
    source_metadata = COALESCE(source_metadata, '{}'::jsonb) || jsonb_build_object(
      'linked_on_signup', true,
      'linked_at', now(),
      'was_lead_only_request', true
    )
  WHERE user_id IS NULL 
    AND lead_email = NEW.email
    AND lead_email IS NOT NULL;
    
  RETURN NEW;
END;
$function$;

-- Step 4: Create trigger to automatically link lead requests on user signup
CREATE TRIGGER on_profile_created_link_leads
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.link_lead_requests_on_signup();