-- Reset the failed M&A guide generation so it can be retried
UPDATE ma_guide_generations 
SET status = 'pending', error = NULL, phases_completed = 0, current_phase = 'Queued for retry'
WHERE id = '1830c503-aa3e-439e-872a-bdebc2883dd9';

-- Fix transcripts that have real content but are stuck at 'pending' with processed_at set
-- These were processed but extraction_status was never updated
UPDATE deal_transcripts 
SET extraction_status = 'completed'
WHERE extraction_status = 'pending' 
  AND processed_at IS NOT NULL 
  AND extracted_data IS NOT NULL;