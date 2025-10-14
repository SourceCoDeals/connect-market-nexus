-- Drop the old constraint and add new one that includes 'website'
ALTER TABLE public.deals
DROP CONSTRAINT IF EXISTS deals_source_check;

ALTER TABLE public.deals
ADD CONSTRAINT deals_source_check 
CHECK (source = ANY (ARRAY['manual'::text, 'marketplace'::text, 'webflow'::text, 'import'::text, 'website'::text]));

-- Now update existing deals to have correct 'website' source
UPDATE public.deals
SET source = 'website'
WHERE connection_request_id IN (
  SELECT id 
  FROM public.connection_requests 
  WHERE source = 'website' 
    AND source_metadata->>'import_method' = 'csv_bulk_upload'
)
AND source = 'webflow';