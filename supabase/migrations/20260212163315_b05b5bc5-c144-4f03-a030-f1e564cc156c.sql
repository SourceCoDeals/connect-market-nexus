-- Drop the partial index that doesn't work with PostgREST upsert
DROP INDEX IF EXISTS idx_listings_captarget_row_hash;

-- Add a proper unique constraint that PostgREST can use for ON CONFLICT
ALTER TABLE public.listings ADD CONSTRAINT uq_listings_captarget_row_hash UNIQUE (captarget_row_hash);