
-- Reset failed scoring queue items that failed due to HTTP 401 (now fixed) or ma_guide_missing (guide now completed)
UPDATE remarketing_scoring_queue
SET status = 'pending', 
    attempts = 0, 
    last_error = NULL, 
    processed_at = NULL
WHERE status = 'failed' 
  AND (last_error = 'HTTP 401' OR last_error = 'ma_guide_missing');

-- Fix transcripts that have extracted_data but are still pending (processed but status not updated)
UPDATE deal_transcripts
SET extraction_status = 'completed'
WHERE extraction_status = 'pending'
  AND extracted_data IS NOT NULL;
