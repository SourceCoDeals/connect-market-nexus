-- Fix invalid activity types in RPC function
CREATE OR REPLACE FUNCTION move_deal_stage_with_ownership(
  p_deal_id uuid,
  p_new_stage_id uuid,
  p_current_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deal_record RECORD;
  v_new_stage_record RECORD;
  v_old_stage_name text;
  v_new_stage_name text;
  v_should_assign_owner boolean := false;
  v_different_owner boolean := false;
  v_previous_owner_id uuid;
  v_previous_owner_name text;
  v_current_admin_name text;
  v_result jsonb;
BEGIN
  -- Get current deal info
  SELECT * INTO v_deal_record FROM deals WHERE id = p_deal_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;
  
  -- Get old and new stage names
  SELECT name INTO v_old_stage_name FROM deal_stages WHERE id = v_deal_record.stage_id;
  SELECT * INTO v_new_stage_record FROM deal_stages WHERE id = p_new_stage_id;
  v_new_stage_name := v_new_stage_record.name;
  
  -- Check if we should auto-assign owner
  -- Condition: Moving FROM "New Inquiry" AND assigned_to is NULL
  IF v_old_stage_name = 'New Inquiry' AND v_deal_record.assigned_to IS NULL THEN
    v_should_assign_owner := true;
  END IF;
  
  -- Check if different admin is modifying an assigned deal
  IF v_deal_record.assigned_to IS NOT NULL 
     AND v_deal_record.assigned_to != p_current_admin_id THEN
    v_different_owner := true;
    v_previous_owner_id := v_deal_record.assigned_to;
    
    -- Get previous owner name
    SELECT first_name || ' ' || last_name INTO v_previous_owner_name
    FROM profiles
    WHERE id = v_previous_owner_id;
    
    -- Get current admin name
    SELECT first_name || ' ' || last_name INTO v_current_admin_name
    FROM profiles
    WHERE id = p_current_admin_id;
  END IF;
  
  -- Update deal stage
  UPDATE deals
  SET 
    stage_id = p_new_stage_id,
    stage_entered_at = now(),
    updated_at = now(),
    -- Auto-assign owner if conditions met
    assigned_to = CASE 
      WHEN v_should_assign_owner THEN p_current_admin_id
      ELSE assigned_to
    END,
    owner_assigned_at = CASE
      WHEN v_should_assign_owner THEN now()
      ELSE owner_assigned_at
    END,
    owner_assigned_by = CASE
      WHEN v_should_assign_owner THEN p_current_admin_id
      ELSE owner_assigned_by
    END
  WHERE id = p_deal_id;
  
  -- Log activity for stage change (using valid 'stage_change' type)
  INSERT INTO deal_activities (
    deal_id,
    admin_id,
    activity_type,
    title,
    description,
    metadata
  ) VALUES (
    p_deal_id,
    p_current_admin_id,
    'stage_change',
    'Stage Changed: ' || v_old_stage_name || ' → ' || v_new_stage_name,
    CASE 
      WHEN v_should_assign_owner THEN 
        'Deal moved to ' || v_new_stage_name || '. Owner auto-assigned.'
      WHEN v_different_owner THEN
        'Deal moved by ' || COALESCE(v_current_admin_name, 'admin') || ' (different from owner: ' || COALESCE(v_previous_owner_name, 'unknown') || ')'
      ELSE
        'Deal moved to ' || v_new_stage_name
    END,
    jsonb_build_object(
      'old_stage', v_old_stage_name,
      'new_stage', v_new_stage_name,
      'owner_assigned', v_should_assign_owner,
      'different_owner', v_different_owner,
      'previous_owner_id', v_previous_owner_id,
      'current_admin_id', p_current_admin_id
    )
  );
  
  -- Create in-app notification for previous owner if different admin modified
  IF v_different_owner THEN
    INSERT INTO admin_notifications (
      admin_id,
      deal_id,
      notification_type,
      title,
      message,
      action_url,
      metadata
    ) VALUES (
      v_previous_owner_id,
      p_deal_id,
      'deal_modified',
      'Your deal was modified',
      COALESCE(v_current_admin_name, 'Another admin') || ' moved your deal from "' || v_old_stage_name || '" to "' || v_new_stage_name || '"',
      '/admin/pipeline?deal=' || p_deal_id,
      jsonb_build_object(
        'modifying_admin_id', p_current_admin_id,
        'modifying_admin_name', v_current_admin_name,
        'old_stage', v_old_stage_name,
        'new_stage', v_new_stage_name
      )
    );
  END IF;
  
  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'deal_id', p_deal_id,
    'old_stage_name', v_old_stage_name,
    'new_stage_name', v_new_stage_name,
    'owner_assigned', v_should_assign_owner,
    'different_owner_warning', v_different_owner,
    'previous_owner_id', v_previous_owner_id,
    'previous_owner_name', v_previous_owner_name,
    'assigned_to', CASE WHEN v_should_assign_owner THEN p_current_admin_id ELSE v_deal_record.assigned_to END
  );
  
  RETURN v_result;
END;
$$;