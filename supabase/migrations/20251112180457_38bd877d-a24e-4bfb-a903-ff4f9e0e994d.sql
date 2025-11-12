-- Phase 1: Rename "Initial Review" to "Follow-up"
UPDATE deal_stages 
SET name = 'Follow-up', 
    updated_at = now()
WHERE id = '351c642b-2ccb-4d49-b19e-6c0cda715be1';

-- Phase 2: Add "Interested in meeting buyer" stage
-- Step 1: Shift positions 5-8 to 6-9 (descending order to avoid unique constraint violations)
UPDATE deal_stages SET position = 9, updated_at = now() WHERE position = 8 AND is_active = true;
UPDATE deal_stages SET position = 8, updated_at = now() WHERE position = 7 AND is_active = true;
UPDATE deal_stages SET position = 7, updated_at = now() WHERE position = 6 AND is_active = true;
UPDATE deal_stages SET position = 6, updated_at = now() WHERE position = 5 AND is_active = true;

-- Step 2: Insert new stage at position 5
INSERT INTO deal_stages (
  name, 
  description, 
  position, 
  color, 
  is_active, 
  is_default, 
  is_system_stage,
  default_probability
) VALUES (
  'Interested in meeting buyer',
  'Seller has expressed interest in meeting with the buyer',
  5,
  '#8b5cf6',
  true,
  false,
  false,
  60
);

-- Step 3: Update all pipeline views to include new stage configuration
UPDATE pipeline_views
SET stage_config = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'stageId', stage_data.id,
      'position', stage_data.row_num - 1
    ) ORDER BY stage_data.row_num
  )
  FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY position) as row_num
    FROM deal_stages
    WHERE is_active = true
  ) stage_data
),
updated_at = now()
WHERE is_active = true;