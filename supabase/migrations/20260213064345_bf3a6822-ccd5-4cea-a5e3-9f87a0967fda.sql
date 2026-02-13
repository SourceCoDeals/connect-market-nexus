-- Add owner_response column to listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS owner_response TEXT;

-- Move captarget general_notes data to owner_response
UPDATE listings
SET owner_response = general_notes, general_notes = NULL
WHERE deal_source = 'captarget'
  AND general_notes IS NOT NULL
  AND (owner_response IS NULL OR owner_response = '');