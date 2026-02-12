
-- Fix P0: deal_identifier trigger collision during batch inserts
-- Replace MAX()+1 approach with a proper sequence to avoid all rows in a batch getting the same ID

-- Create a sequence for deal identifiers
CREATE SEQUENCE IF NOT EXISTS public.deal_identifier_seq START WITH 1;

-- Initialise the sequence to current max
DO $$
DECLARE
  max_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN deal_identifier ~ ('^SCO-' || EXTRACT(year FROM NOW())::TEXT || '-[0-9]+$')
      THEN CAST(SUBSTRING(deal_identifier FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) INTO max_seq FROM public.listings;
  
  PERFORM setval('public.deal_identifier_seq', GREATEST(max_seq, 1));
END $$;

-- Replace the function with a sequence-based version
CREATE OR REPLACE FUNCTION public.generate_deal_identifier()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    current_year TEXT;
    next_sequence INTEGER;
BEGIN
    current_year := EXTRACT(year FROM NOW())::TEXT;
    next_sequence := nextval('public.deal_identifier_seq');
    RETURN 'SCO-' || current_year || '-' || LPAD(next_sequence::TEXT, 3, '0');
END;
$function$;
