
-- Reset 1 buyer enrichment item for final verification
UPDATE buyer_enrichment_queue
SET status = 'pending', attempts = 0, last_error = NULL, started_at = NULL, completed_at = NULL, force = true, updated_at = now()
WHERE buyer_id = '3dd6de80-58ff-4741-8787-4be15fbae851' AND status = 'failed';
