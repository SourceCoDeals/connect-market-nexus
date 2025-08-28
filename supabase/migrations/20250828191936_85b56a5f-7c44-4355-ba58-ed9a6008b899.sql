-- First, let's establish the proper linkage between leads and requests
-- Update connection_requests to set source_lead_id where we can match by converted_to_request_id
UPDATE public.connection_requests cr
SET source_lead_id = l.id
FROM public.inbound_leads l
WHERE cr.id = l.converted_to_request_id
  AND cr.source_lead_id IS NULL;

-- Now backfill the sources again with the proper linkage
UPDATE public.connection_requests cr
SET source = l.source,
    source_metadata = COALESCE(cr.source_metadata, '{}'::jsonb) || jsonb_build_object(
      'backfilled_source', true, 
      'backfilled_at', now(),
      'lead_name', l.name,
      'lead_email', l.email,
      'converted_from_lead', true
    )
FROM public.inbound_leads l
WHERE cr.source_lead_id = l.id
  AND (cr.source IS NULL OR cr.source = 'marketplace');