-- Add priority target flag to listings table
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS is_priority_target BOOLEAN DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_listings_priority_target 
ON public.listings(is_priority_target) 
WHERE is_priority_target = true;