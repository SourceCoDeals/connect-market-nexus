CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_captarget_row_hash 
ON public.listings (captarget_row_hash) 
WHERE captarget_row_hash IS NOT NULL;