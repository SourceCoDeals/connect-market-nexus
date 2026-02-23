-- Add a proper unique constraint on listing_id for enrichment_queue
-- so that upsert with onConflict: 'listing_id' works correctly
ALTER TABLE public.enrichment_queue ADD CONSTRAINT enrichment_queue_listing_id_key UNIQUE (listing_id);