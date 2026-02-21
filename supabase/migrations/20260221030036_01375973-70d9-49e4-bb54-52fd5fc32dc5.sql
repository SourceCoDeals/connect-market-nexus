
-- Reset failed HTTP 401 deal scoring items (up to 3) to test the auth fix
UPDATE remarketing_scoring_queue 
SET status = 'pending', attempts = 0, last_error = NULL, processed_at = NULL
WHERE status = 'failed' AND last_error = 'HTTP 401' AND score_type = 'deal';

-- Reset failed HTTP 401 buyer enrichment items to test
UPDATE buyer_enrichment_queue
SET status = 'pending', attempts = 0, last_error = NULL, started_at = NULL, completed_at = NULL, force = true, updated_at = now()
WHERE status = 'failed' AND last_error = 'HTTP 401';

-- Reset 1 deal enrichment item with valid URL
UPDATE enrichment_queue
SET status = 'pending', attempts = 0, last_error = NULL, completed_at = NULL, started_at = NULL, force = true
WHERE id = 'ac81344d-6bb3-47ed-ae5d-f2554a8daa65' AND status = 'failed';
