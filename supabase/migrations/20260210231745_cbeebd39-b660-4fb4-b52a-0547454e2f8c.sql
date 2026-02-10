
-- Clean up duplicate and empty universes

-- 1. Delete 6 empty universe shells (0 buyers, 0 scores, 0 deals)
DELETE FROM remarketing_buyer_universes 
WHERE id IN (
  '4629505d-c384-4430-84db-101f2ae4a800',  -- HVAC (empty)
  'b6a90488-80da-4165-9613-3748c1924378',  -- Collision Repair (empty)
  '5f831b2a-ec57-4aeb-8434-2c9eb0bf2281',  -- Roofing (empty)
  '2351c952-1f12-42fa-92e3-abcfb3de4c2a',  -- RIA (empty)
  '5528ccd3-8dc7-41fd-8e7b-f6edf06c305b',  -- Restoration (empty, duplicate)
  '4dd0db10-9401-4289-8211-932f39f05222'   -- Law Firms (empty)
);

-- 2. Merge duplicate "Restoration and Remediation" buyers into the primary universe
-- Move 20 buyers from 45a13bc8 → f7f75730 (the older, larger universe)
UPDATE remarketing_buyers 
SET universe_id = 'f7f75730-cbf8-4662-8736-106d8fb87640'
WHERE universe_id = '45a13bc8-d26b-4326-b682-216a12abdc37'
  AND id NOT IN (
    SELECT id FROM remarketing_buyers WHERE universe_id = 'f7f75730-cbf8-4662-8736-106d8fb87640'
  );

-- Move 18 buyers from "Restoration" (f32fb7a5) → primary "Restoration and Remediation" (f7f75730)
UPDATE remarketing_buyers 
SET universe_id = 'f7f75730-cbf8-4662-8736-106d8fb87640'
WHERE universe_id = 'f32fb7a5-e01e-4b0e-a3bf-125f8c01dc81'
  AND id NOT IN (
    SELECT id FROM remarketing_buyers WHERE universe_id = 'f7f75730-cbf8-4662-8736-106d8fb87640'
  );

-- Also move any enrichment queue items
UPDATE buyer_enrichment_queue
SET universe_id = 'f7f75730-cbf8-4662-8736-106d8fb87640'
WHERE universe_id IN ('45a13bc8-d26b-4326-b682-216a12abdc37', 'f32fb7a5-e01e-4b0e-a3bf-125f8c01dc81');

-- Delete the now-empty duplicate universes
DELETE FROM remarketing_buyer_universes 
WHERE id IN (
  '45a13bc8-d26b-4326-b682-216a12abdc37',
  'f32fb7a5-e01e-4b0e-a3bf-125f8c01dc81'
);
