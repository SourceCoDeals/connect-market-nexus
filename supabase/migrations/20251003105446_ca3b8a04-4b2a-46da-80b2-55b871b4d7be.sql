-- Remove "Under Contract" stage and shift Closed Won/Lost positions
-- First, delete Under Contract stage
DELETE FROM deal_stages WHERE name = 'Under Contract';

-- Update Closed Won to position 9 (displays as stage 10)
UPDATE deal_stages 
SET position = 9,
    updated_at = now()
WHERE name = 'Closed Won';

-- Update Closed Lost to position 10
UPDATE deal_stages 
SET position = 10,
    updated_at = now()
WHERE name = 'Closed Lost';