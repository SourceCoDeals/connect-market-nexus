-- Move all deals to New Inquiry stage
DO $$
DECLARE
  new_inquiry_stage_id uuid;
BEGIN
  -- Get New Inquiry stage ID
  SELECT id INTO new_inquiry_stage_id
  FROM public.deal_stages
  WHERE name = 'New Inquiry'
  LIMIT 1;

  -- Move all deals to New Inquiry stage with correct probability
  UPDATE public.deals
  SET 
    stage_id = new_inquiry_stage_id,
    probability = 5, -- New Inquiry default probability
    stage_entered_at = NOW(),
    updated_at = NOW()
  WHERE stage_id != new_inquiry_stage_id; -- Only update deals not already in New Inquiry
END $$;