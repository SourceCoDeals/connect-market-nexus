-- Reset ONE failed deal scoring item to test the auth fix
UPDATE remarketing_scoring_queue 
SET status = 'pending', attempts = 0, last_error = NULL, processed_at = NULL
WHERE id = '665ef0da-2389-4291-9d78-9df73ce32264' AND status = 'failed';

-- Reset ONE failed enrichment item to test AI provider
UPDATE enrichment_queue
SET status = 'pending', attempts = 0, last_error = NULL, completed_at = NULL, started_at = NULL, force = true
WHERE id = '4f7aa329-7b71-4fb0-bba6-c98a73174628' AND status = 'failed';