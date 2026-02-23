
-- First move deals out of stages being deactivated
UPDATE deals SET stage_id = 'd7f71fde-7c73-4ef4-87a2-fc48746e2ff6' WHERE stage_id IN (
  '351c642b-2ccb-4d49-b19e-6c0cda715be1',
  '8ce7742e-ec8b-4c49-9302-d93835a5da48'
);

-- Rename "New Inquiry" to "Approved"
UPDATE deal_stages SET name = 'Approved' WHERE id = 'd7f71fde-7c73-4ef4-87a2-fc48746e2ff6';

-- Move all positions to high temp values to avoid unique constraint conflicts
UPDATE deal_stages SET position = 100 WHERE id = 'd7f71fde-7c73-4ef4-87a2-fc48746e2ff6';
UPDATE deal_stages SET position = 101 WHERE id = '351c642b-2ccb-4d49-b19e-6c0cda715be1';
UPDATE deal_stages SET position = 102 WHERE id = '8ce7742e-ec8b-4c49-9302-d93835a5da48';
UPDATE deal_stages SET position = 103 WHERE id = '40e1977f-320d-4519-9261-791adb1550b6';
UPDATE deal_stages SET position = 104 WHERE id = '127195f7-4320-4ae3-a378-6163674b3401';
UPDATE deal_stages SET position = 105 WHERE id = 'c2baacc5-18d9-49a7-a2fe-30aea4cfd828';
UPDATE deal_stages SET position = 106 WHERE id = '187dd9d3-40a7-4b96-b8cf-f1b6ed40c7ac';
UPDATE deal_stages SET position = 107 WHERE id = '5f5f992d-1e3a-46d1-8226-042e0fdaff56';
UPDATE deal_stages SET position = 108 WHERE id = '7f2e27c7-6690-4c3c-a43c-ef7066e6e66f';
UPDATE deal_stages SET position = 109 WHERE id = 'b305fcf8-0c5f-4bd4-8706-45daa594a002';

-- Deactivate "Follow-up" and "NDA + Agreement Sent"
UPDATE deal_stages SET is_active = false WHERE id IN (
  '351c642b-2ccb-4d49-b19e-6c0cda715be1',
  '8ce7742e-ec8b-4c49-9302-d93835a5da48'
);

-- Now set final positions
UPDATE deal_stages SET position = 0 WHERE id = 'd7f71fde-7c73-4ef4-87a2-fc48746e2ff6'; -- Approved
UPDATE deal_stages SET position = 1 WHERE id = '40e1977f-320d-4519-9261-791adb1550b6'; -- Info Sent
UPDATE deal_stages SET position = 2 WHERE id = '127195f7-4320-4ae3-a378-6163674b3401'; -- Owner intro requested
UPDATE deal_stages SET position = 3 WHERE id = 'c2baacc5-18d9-49a7-a2fe-30aea4cfd828'; -- Buyer/Seller Call
UPDATE deal_stages SET position = 4 WHERE id = '187dd9d3-40a7-4b96-b8cf-f1b6ed40c7ac'; -- Due Diligence
UPDATE deal_stages SET position = 5 WHERE id = '5f5f992d-1e3a-46d1-8226-042e0fdaff56'; -- LOI Submitted
UPDATE deal_stages SET position = 6 WHERE id = '7f2e27c7-6690-4c3c-a43c-ef7066e6e66f'; -- Closed Won
UPDATE deal_stages SET position = 7 WHERE id = 'b305fcf8-0c5f-4bd4-8706-45daa594a002'; -- Closed Lost
UPDATE deal_stages SET position = 8 WHERE id = '351c642b-2ccb-4d49-b19e-6c0cda715be1'; -- deactivated Follow-up
UPDATE deal_stages SET position = 9 WHERE id = '8ce7742e-ec8b-4c49-9302-d93835a5da48'; -- deactivated NDA
