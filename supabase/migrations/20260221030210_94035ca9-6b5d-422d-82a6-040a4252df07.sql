
-- Reset 1 buyer enrichment item to verify the auth fix
UPDATE buyer_enrichment_queue
SET status = 'pending', attempts = 0, last_error = NULL, started_at = NULL, completed_at = NULL, force = true, updated_at = now()
WHERE buyer_id = '3dd6de80-58ff-4741-8787-4be15fbae851' AND status = 'failed';

-- Reset 1 scoring item
UPDATE remarketing_scoring_queue 
SET status = 'pending', attempts = 0, last_error = NULL, processed_at = NULL
WHERE id = '5568346c-907a-488e-acec-de926bd40b5c' AND status = 'failed';
