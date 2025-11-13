-- Phase 1.1: Add primary_owner_id to listings table
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS primary_owner_id uuid REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_listings_primary_owner ON listings(primary_owner_id);

COMMENT ON COLUMN listings.primary_owner_id IS 'SourceCo/CapTarget employee who owns the relationship with the business owner';

-- Phase 1.2: Add deal ownership tracking fields to deals table
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS owner_assigned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS owner_assigned_by uuid REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);

COMMENT ON COLUMN deals.assigned_to IS 'Admin who owns this buyer relationship (Deal Owner)';
COMMENT ON COLUMN deals.owner_assigned_at IS 'When the deal owner was first assigned';
COMMENT ON COLUMN deals.owner_assigned_by IS 'Admin who assigned the deal owner (usually themselves)';

-- Phase 1.3: Create owner_intro_notifications table
CREATE TABLE IF NOT EXISTS owner_intro_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  primary_owner_id uuid NOT NULL REFERENCES profiles(id),
  sent_at timestamp with time zone DEFAULT now(),
  sent_by uuid REFERENCES profiles(id),
  email_status text DEFAULT 'sent',
  email_error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_intro_notifications_deal ON owner_intro_notifications(deal_id);
CREATE INDEX IF NOT EXISTS idx_owner_intro_notifications_listing ON owner_intro_notifications(listing_id);
CREATE INDEX IF NOT EXISTS idx_owner_intro_notifications_owner ON owner_intro_notifications(primary_owner_id);

-- Enable RLS on owner_intro_notifications
ALTER TABLE owner_intro_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for owner_intro_notifications
CREATE POLICY "Admins can view all owner intro notifications"
  ON owner_intro_notifications FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "System can insert owner intro notifications"
  ON owner_intro_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Phase 1.4: Create RPC function for deal stage movement with ownership
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
  
  -- Log activity if owner was auto-assigned
  IF v_should_assign_owner THEN
    INSERT INTO deal_activities (
      deal_id,
      admin_id,
      activity_type,
      title,
      description
    ) VALUES (
      p_deal_id,
      p_current_admin_id,
      'owner_assigned',
      'Deal Owner Auto-Assigned',
      'Deal owner was automatically assigned when moving from New Inquiry stage'
    );
  END IF;
  
  -- Log activity if different owner modified
  IF v_different_owner THEN
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
      'cross_admin_modification',
      'Deal Modified by Different Admin',
      'Deal was modified by an admin who is not the owner',
      jsonb_build_object('previous_owner_id', v_previous_owner_id, 'previous_owner_name', v_previous_owner_name)
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
    'previous_owner_name', v_previous_owner_name,
    'assigned_to', CASE WHEN v_should_assign_owner THEN p_current_admin_id ELSE v_deal_record.assigned_to END
  );
  
  RETURN v_result;
END;
$$;