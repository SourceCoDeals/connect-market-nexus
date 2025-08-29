-- Database and UX Optimization Plan Implementation

-- Step 1: Remove duplicate "Due Diligence" stage and redistribute deals
-- Keep the first Due Diligence stage (position 4) and remove the duplicate (position 5)

-- First, move any deals from the duplicate stage to the primary one
UPDATE deals 
SET stage_id = '187dd9d3-40a7-4b96-b8cf-f1b6ed40c7ac'
WHERE stage_id = '2f216761-1ab5-4abf-950b-f7caccddf056';

-- Delete the duplicate Due Diligence stage
DELETE FROM deal_stages 
WHERE id = '2f216761-1ab5-4abf-950b-f7caccddf056';

-- Step 2: Redistribute test deals across stages for better visualization
-- Move some deals from "Qualified" to other stages for demo purposes

-- Get some deal IDs from the qualified stage
WITH qualified_deals AS (
  SELECT id 
  FROM deals 
  WHERE stage_id = 'a08d0ca5-fd75-4c25-be41-96d09bf79ca0'
  ORDER BY created_at
  LIMIT 30
),
deal_batches AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY id) as rn
  FROM qualified_deals
)
-- Distribute deals across different stages
UPDATE deals 
SET stage_id = CASE 
  WHEN id IN (SELECT id FROM deal_batches WHERE rn <= 5) 
    THEN '40e1977f-320d-4519-9261-791adb1550b6' -- Information Sent
  WHEN id IN (SELECT id FROM deal_batches WHERE rn > 5 AND rn <= 10) 
    THEN '187dd9d3-40a7-4b96-b8cf-f1b6ed40c7ac' -- Due Diligence
  WHEN id IN (SELECT id FROM deal_batches WHERE rn > 10 AND rn <= 15) 
    THEN '5f5f992d-1e3a-46d1-8226-042e0fdaff56' -- LOI Submitted
  WHEN id IN (SELECT id FROM deal_batches WHERE rn > 15 AND rn <= 20) 
    THEN '0bf9a7e9-0bdb-4f14-9022-78b67b67d07c' -- Under Contract
  WHEN id IN (SELECT id FROM deal_batches WHERE rn > 20 AND rn <= 25) 
    THEN '7f2e27c7-6690-4c3c-a43c-ef7066e6e66f' -- Closed Won
  WHEN id IN (SELECT id FROM deal_batches WHERE rn > 25 AND rn <= 30) 
    THEN '6265ef6a-82b6-4c3b-8ffa-b5671d3f0bde' -- Closed Lost
  ELSE stage_id
END
WHERE stage_id = 'a08d0ca5-fd75-4c25-be41-96d09bf79ca0'
AND id IN (SELECT id FROM deal_batches);

-- Step 3: Update stage positions to ensure proper ordering after deletion
UPDATE deal_stages 
SET position = CASE 
  WHEN position > 5 THEN position - 1
  ELSE position
END
WHERE position > 5;