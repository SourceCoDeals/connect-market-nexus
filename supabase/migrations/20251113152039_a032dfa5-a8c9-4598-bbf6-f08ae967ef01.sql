-- Create secure RPC for updating deal owner
-- This bypasses any view/trigger issues by directly updating the deals table
CREATE OR REPLACE FUNCTION public.update_deal_owner(
  p_deal_id uuid,
  p_assigned_to uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid;
  v_result jsonb;
  v_old_owner uuid;
BEGIN
  -- Use provided actor or current auth user
  v_actor_id := COALESCE(p_actor_id, auth.uid());
  
  -- Permission check: must be admin
  IF NOT public.is_admin(v_actor_id) THEN
    RAISE EXCEPTION 'Only admins can update deal ownership';
  END IF;
  
  -- Get old owner for logging
  SELECT assigned_to INTO v_old_owner
  FROM public.deals
  WHERE id = p_deal_id;
  
  -- Update the deal owner directly
  UPDATE public.deals
  SET 
    assigned_to = p_assigned_to,
    updated_at = NOW()
  WHERE id = p_deal_id;
  
  -- Return minimal required fields
  SELECT jsonb_build_object(
    'id', id,
    'assigned_to', assigned_to,
    'updated_at', updated_at,
    'stage_id', stage_id,
    'nda_status', nda_status,
    'fee_agreement_status', fee_agreement_status,
    'followed_up', followed_up,
    'negative_followed_up', negative_followed_up
  ) INTO v_result
  FROM public.deals
  WHERE id = p_deal_id;
  
  -- Log the assignment change
  IF v_old_owner IS DISTINCT FROM p_assigned_to THEN
    INSERT INTO public.deal_activities (
      deal_id,
      admin_id,
      activity_type,
      title,
      description,
      metadata
    ) VALUES (
      p_deal_id,
      v_actor_id,
      'assignment_changed',
      'Deal Owner Changed',
      CASE 
        WHEN v_old_owner IS NULL AND p_assigned_to IS NOT NULL THEN 'Deal assigned'
        WHEN v_old_owner IS NOT NULL AND p_assigned_to IS NULL THEN 'Deal unassigned'
        ELSE 'Deal reassigned'
      END,
      jsonb_build_object(
        'old_owner', v_old_owner,
        'new_owner', p_assigned_to,
        'changed_by', v_actor_id
      )
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (permission check is inside function)
GRANT EXECUTE ON FUNCTION public.update_deal_owner(uuid, uuid, uuid) TO authenticated;