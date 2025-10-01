-- Add negative follow-up columns to deals table
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS negative_followed_up boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS negative_followed_up_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS negative_followed_up_by uuid REFERENCES auth.users(id);

-- Update the sync trigger to handle BOTH positive and negative follow-up
CREATE OR REPLACE FUNCTION public.sync_followup_to_deals()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync positive follow-up status
  IF (OLD.followed_up IS DISTINCT FROM NEW.followed_up) 
     OR (OLD.followed_up_at IS DISTINCT FROM NEW.followed_up_at)
     OR (OLD.followed_up_by IS DISTINCT FROM NEW.followed_up_by) THEN
    
    UPDATE public.deals
    SET 
      followed_up = NEW.followed_up,
      followed_up_at = NEW.followed_up_at,
      followed_up_by = NEW.followed_up_by,
      updated_at = NOW()
    WHERE connection_request_id = NEW.id;
  END IF;
  
  -- Sync negative follow-up status
  IF (OLD.negative_followed_up IS DISTINCT FROM NEW.negative_followed_up) 
     OR (OLD.negative_followed_up_at IS DISTINCT FROM NEW.negative_followed_up_at)
     OR (OLD.negative_followed_up_by IS DISTINCT FROM NEW.negative_followed_up_by) THEN
    
    UPDATE public.deals
    SET 
      negative_followed_up = NEW.negative_followed_up,
      negative_followed_up_at = NEW.negative_followed_up_at,
      negative_followed_up_by = NEW.negative_followed_up_by,
      updated_at = NOW()
    WHERE connection_request_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to include negative follow-up conditions
DROP TRIGGER IF EXISTS sync_followup_to_deals ON public.connection_requests;
CREATE TRIGGER sync_followup_to_deals
  AFTER UPDATE ON public.connection_requests
  FOR EACH ROW
  WHEN (OLD.followed_up IS DISTINCT FROM NEW.followed_up 
        OR OLD.followed_up_at IS DISTINCT FROM NEW.followed_up_at
        OR OLD.followed_up_by IS DISTINCT FROM NEW.followed_up_by
        OR OLD.negative_followed_up IS DISTINCT FROM NEW.negative_followed_up
        OR OLD.negative_followed_up_at IS DISTINCT FROM NEW.negative_followed_up_at
        OR OLD.negative_followed_up_by IS DISTINCT FROM NEW.negative_followed_up_by)
  EXECUTE FUNCTION public.sync_followup_to_deals();

-- Also create reverse sync: when deals are updated, sync to connection_requests
CREATE OR REPLACE FUNCTION public.sync_followup_to_connection_requests()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if there's a connection_request_id
  IF NEW.connection_request_id IS NOT NULL THEN
    -- Sync positive follow-up
    IF (OLD.followed_up IS DISTINCT FROM NEW.followed_up) 
       OR (OLD.followed_up_at IS DISTINCT FROM NEW.followed_up_at)
       OR (OLD.followed_up_by IS DISTINCT FROM NEW.followed_up_by) THEN
      
      UPDATE public.connection_requests
      SET 
        followed_up = NEW.followed_up,
        followed_up_at = NEW.followed_up_at,
        followed_up_by = NEW.followed_up_by,
        updated_at = NOW()
      WHERE id = NEW.connection_request_id;
    END IF;
    
    -- Sync negative follow-up
    IF (OLD.negative_followed_up IS DISTINCT FROM NEW.negative_followed_up) 
       OR (OLD.negative_followed_up_at IS DISTINCT FROM NEW.negative_followed_up_at)
       OR (OLD.negative_followed_up_by IS DISTINCT FROM NEW.negative_followed_up_by) THEN
      
      UPDATE public.connection_requests
      SET 
        negative_followed_up = NEW.negative_followed_up,
        negative_followed_up_at = NEW.negative_followed_up_at,
        negative_followed_up_by = NEW.negative_followed_up_by,
        updated_at = NOW()
      WHERE id = NEW.connection_request_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for reverse sync
DROP TRIGGER IF EXISTS sync_followup_to_connection_requests ON public.deals;
CREATE TRIGGER sync_followup_to_connection_requests
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  WHEN (OLD.followed_up IS DISTINCT FROM NEW.followed_up 
        OR OLD.followed_up_at IS DISTINCT FROM NEW.followed_up_at
        OR OLD.followed_up_by IS DISTINCT FROM NEW.followed_up_by
        OR OLD.negative_followed_up IS DISTINCT FROM NEW.negative_followed_up
        OR OLD.negative_followed_up_at IS DISTINCT FROM NEW.negative_followed_up_at
        OR OLD.negative_followed_up_by IS DISTINCT FROM NEW.negative_followed_up_by)
  EXECUTE FUNCTION public.sync_followup_to_connection_requests();