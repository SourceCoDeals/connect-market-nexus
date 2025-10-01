-- Create atomic move function for deal stage changes with activity logging
CREATE OR REPLACE FUNCTION public.move_deal_stage(deal_id uuid, new_stage_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  admin_user uuid;
  old_stage_id uuid;
  from_stage_name text;
  to_stage_name text;
BEGIN
  -- Ensure authenticated admin
  SELECT auth.uid() INTO admin_user;
  IF admin_user IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF NOT is_admin(admin_user) THEN
    RAISE EXCEPTION 'Only admins can move deals';
  END IF;

  -- Get current stage
  SELECT d.stage_id INTO old_stage_id
  FROM public.deals d
  WHERE d.id = move_deal_stage.deal_id;

  IF old_stage_id IS NULL THEN
    RAISE EXCEPTION 'Deal not found or has no stage';
  END IF;

  -- Update deal stage atomically
  UPDATE public.deals
  SET stage_id = new_stage_id,
      stage_entered_at = NOW(),
      updated_at = NOW()
  WHERE id = move_deal_stage.deal_id;

  -- Resolve stage names for logging
  SELECT name INTO from_stage_name FROM public.deal_stages WHERE id = old_stage_id;
  SELECT name INTO to_stage_name FROM public.deal_stages WHERE id = new_stage_id;

  -- Log activity
  INSERT INTO public.deal_activities (
    deal_id,
    admin_id,
    activity_type,
    title,
    description,
    metadata
  ) VALUES (
    move_deal_stage.deal_id,
    admin_user,
    'stage_change',
    COALESCE('Moved to ' || to_stage_name, 'Moved to new stage'),
    CASE 
      WHEN from_stage_name IS NULL THEN 'Deal moved to ' || COALESCE(to_stage_name,'new stage')
      ELSE 'Deal moved from "' || from_stage_name || '" to "' || COALESCE(to_stage_name,'new stage') || '"'
    END,
    jsonb_build_object(
      'from_stage', from_stage_name,
      'to_stage', to_stage_name,
      'from_stage_id', old_stage_id,
      'to_stage_id', new_stage_id
    )
  );

  RETURN TRUE;
END;
$$;