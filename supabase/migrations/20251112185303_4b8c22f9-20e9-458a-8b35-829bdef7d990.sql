-- Phase 1: Rename "Interested in meeting buyer" to "Owner intro requested"
UPDATE deal_stages 
SET 
  name = 'Owner intro requested',
  description = 'Buyer has explicitly requested an owner introduction call and there is real fit (not tire-kicking)',
  updated_at = now()
WHERE id = '127195f7-4320-4ae3-a378-6163674b3401';

-- Phase 2: Swap positions between "Owner intro requested" and "Buyer/Seller Call"
-- Step 1: Temporarily move "Buyer/Seller Call" to position -1 (placeholder)
UPDATE deal_stages 
SET position = -1, updated_at = now() 
WHERE id = 'c2baacc5-18d9-49a7-a2fe-30aea4cfd828';

-- Step 2: Move "Owner intro requested" to position 4
UPDATE deal_stages 
SET position = 4, updated_at = now() 
WHERE id = '127195f7-4320-4ae3-a378-6163674b3401';

-- Step 3: Move "Buyer/Seller Call" to position 5
UPDATE deal_stages 
SET position = 5, updated_at = now() 
WHERE id = 'c2baacc5-18d9-49a7-a2fe-30aea4cfd828';

-- Phase 3: Update all pipeline views to reflect new stage order
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