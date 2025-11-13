-- Update update_deal_owner RPC to allow current owner and listing primary owner
-- Drop and recreate with expanded permissions
DROP FUNCTION IF EXISTS public.update_deal_owner(uuid, uuid, uuid);

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
  v_listing_id uuid;
  v_primary_owner uuid;
BEGIN
  -- Use provided actor or current auth user
  v_actor_id := COALESCE(p_actor_id, auth.uid());
  
  -- Get old owner and listing info for permission check
  SELECT assigned_to, listing_id INTO v_old_owner, v_listing_id
  FROM public.deals
  WHERE id = p_deal_id;
  
  -- Get listing primary owner
  SELECT primary_owner_id INTO v_primary_owner
  FROM public.listings
  WHERE id = v_listing_id;
  
  -- Permission check: must be admin, current owner, or listing primary owner
  IF NOT (
    public.is_admin(v_actor_id) OR 
    v_actor_id = v_old_owner OR 
    v_actor_id = v_primary_owner
  ) THEN
    RAISE EXCEPTION 'Only admins, current owners, or listing primary owners can update deal ownership';
  END IF;
  
  -- Update the deal owner directly with assignment tracking
  UPDATE public.deals
  SET 
    assigned_to = p_assigned_to,
    owner_assigned_by = v_actor_id,
    owner_assigned_at = NOW(),
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