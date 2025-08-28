-- Backfill existing connection request sources from linked leads
UPDATE public.connection_requests cr
SET source = l.source,
    source_metadata = COALESCE(cr.source_metadata, '{}'::jsonb) || jsonb_build_object('backfilled_source', true, 'backfilled_at', now())
FROM public.inbound_leads l
WHERE cr.source_lead_id = l.id
  AND (cr.source IS NULL OR cr.source = 'marketplace');

-- Ensure future inserts inherit source from the lead when missing or defaulted to marketplace
CREATE OR REPLACE FUNCTION public.ensure_source_from_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lead_source text;
BEGIN
  IF NEW.source_lead_id IS NOT NULL AND (NEW.source IS NULL OR NEW.source = 'marketplace') THEN
    SELECT source INTO lead_source FROM public.inbound_leads WHERE id = NEW.source_lead_id;
    IF lead_source IS NOT NULL THEN
      NEW.source := lead_source;
      NEW.source_metadata := COALESCE(NEW.source_metadata, '{}'::jsonb) || jsonb_build_object('auto_source_from_lead', true);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_source_from_lead ON public.connection_requests;
CREATE TRIGGER trg_ensure_source_from_lead
BEFORE INSERT ON public.connection_requests
FOR EACH ROW
EXECUTE FUNCTION public.ensure_source_from_lead();