
-- First delete the firm_member referencing the test connection request
DELETE FROM firm_members WHERE id = '342920c8-bef2-4582-929d-7237d62daec0';

-- Then delete the 4 test connection requests
DELETE FROM connection_requests 
WHERE id IN (
  '435a5d2f-c097-469a-b8ad-0dc46824ccd5',
  '6d7da75f-fc3d-4db0-a1f2-81ba1e8b5e6c',
  '3d040cc4-8256-410f-a398-37501144d5fd',
  '92eee467-cc46-4297-95a1-b82ab86fa1f4'
);
