-- Add 'paused' to enrichment_queue status check constraint
ALTER TABLE public.enrichment_queue DROP CONSTRAINT enrichment_queue_status_check;
ALTER TABLE public.enrichment_queue ADD CONSTRAINT enrichment_queue_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'paused'::text]));