-- Clear firm_members references to bogus CRs first
UPDATE firm_members SET connection_request_id = NULL
WHERE connection_request_id IN (
  SELECT id FROM connection_requests WHERE source = 'email' AND listing_id IS NULL
);

-- Now delete the bogus CRs
DELETE FROM connection_requests WHERE source = 'email' AND listing_id IS NULL;