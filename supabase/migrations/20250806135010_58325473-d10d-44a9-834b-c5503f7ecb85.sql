-- Add rich text columns to listings table
ALTER TABLE public.listings 
ADD COLUMN description_html TEXT,
ADD COLUMN description_json JSONB;

-- Update existing listings to have HTML version of their description
UPDATE public.listings 
SET description_html = '<p>' || REPLACE(description, E'\n', '</p><p>') || '</p>'
WHERE description_html IS NULL AND description IS NOT NULL;