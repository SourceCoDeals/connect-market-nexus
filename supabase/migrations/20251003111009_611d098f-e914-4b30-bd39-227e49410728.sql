-- Phase 1: Critical Stage Management Fixes

-- Step 1: Fix orphaned deals - assign them to "New Inquiry" stage
UPDATE deals 
SET 
  stage_id = (SELECT id FROM deal_stages WHERE name = 'New Inquiry' LIMIT 1),
  probability = 5,
  stage_entered_at = now(),
  updated_at = now()
WHERE stage_id IS NULL;

-- Step 2: Make stage_id NOT NULL (now safe since we fixed orphans)
ALTER TABLE deals 
ALTER COLUMN stage_id SET NOT NULL;

-- Step 3: Drop existing foreign key and recreate with ON DELETE RESTRICT
ALTER TABLE deals 
DROP CONSTRAINT IF EXISTS deals_stage_id_fkey;

ALTER TABLE deals
ADD CONSTRAINT deals_stage_id_fkey 
FOREIGN KEY (stage_id) 
REFERENCES deal_stages(id) 
ON DELETE RESTRICT;

-- Step 4: Add is_system_stage column to deal_stages
ALTER TABLE deal_stages
ADD COLUMN IF NOT EXISTS is_system_stage boolean DEFAULT false;

-- Mark critical system stages that should have special protections
UPDATE deal_stages 
SET is_system_stage = true 
WHERE name IN ('New Inquiry', 'Closed Won', 'Closed Lost');

-- Step 5: Ensure only "New Inquiry" is the default stage at position 0
-- First, remove default from all other stages
UPDATE deal_stages 
SET is_default = false 
WHERE name != 'New Inquiry';

-- Then ensure New Inquiry is default and at position 0
UPDATE deal_stages 
SET 
  is_default = true,
  position = 0,
  updated_at = now()
WHERE name = 'New Inquiry';

-- Step 6: Create function to get deal count for a stage (useful for UI)
CREATE OR REPLACE FUNCTION public.get_stage_deal_count(stage_uuid uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM deals
  WHERE stage_id = stage_uuid 
    AND deleted_at IS NULL;
$$;

-- Step 7: Add unique constraint to ensure only one default stage
CREATE UNIQUE INDEX IF NOT EXISTS deal_stages_single_default_idx 
ON deal_stages (is_default) 
WHERE is_default = true;

-- Step 8: Add comment to document the constraints
COMMENT ON COLUMN deal_stages.is_system_stage IS 'System stages (New Inquiry, Closed Won, Closed Lost) have special UI protections and cannot be deleted';
COMMENT ON COLUMN deal_stages.is_default IS 'Only one stage can be default - this is where new deals enter the pipeline';
COMMENT ON COLUMN deals.stage_id IS 'Required - every deal must have a stage. Foreign key has ON DELETE RESTRICT to prevent orphaned deals';