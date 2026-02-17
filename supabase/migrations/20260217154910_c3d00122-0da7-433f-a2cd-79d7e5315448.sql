
-- Drop and recreate the trigger function with retry logic built in
DROP TRIGGER IF EXISTS auto_generate_deal_identifier_trigger ON public.listings;
DROP FUNCTION IF EXISTS public.auto_generate_deal_identifier();
DROP FUNCTION IF EXISTS public.generate_deal_identifier();

-- Recreate generate_deal_identifier as TEXT return (same signature)
CREATE OR REPLACE FUNCTION public.generate_deal_identifier()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    current_year TEXT;
    next_sequence INTEGER;
BEGIN
    current_year := EXTRACT(year FROM NOW())::TEXT;
    next_sequence := nextval('public.deal_identifier_seq');
    RETURN 'SCO-' || current_year || '-' || LPAD(next_sequence::TEXT, 5, '0');
END;
$$;

-- Recreate trigger function with retry-on-collision logic
CREATE OR REPLACE FUNCTION public.auto_generate_deal_identifier()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
  candidate TEXT;
BEGIN
  IF NEW.deal_identifier IS NOT NULL AND NEW.deal_identifier != '' THEN
    RETURN NEW;
  END IF;

  LOOP
    attempts := attempts + 1;
    IF attempts > max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique deal_identifier after % attempts', max_attempts;
    END IF;

    candidate := public.generate_deal_identifier();

    IF NOT EXISTS (SELECT 1 FROM listings WHERE deal_identifier = candidate) THEN
      NEW.deal_identifier := candidate;
      RETURN NEW;
    END IF;
  END LOOP;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER auto_generate_deal_identifier_trigger
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_deal_identifier();

-- Advance the sequence past all existing identifiers
DO $$
DECLARE
  max_suffix INTEGER;
  target_val INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN deal_identifier ~ '^SCO-[0-9]{4}-[0-9]+$' 
      THEN CAST(SUBSTRING(deal_identifier FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) INTO max_suffix FROM listings;
  
  target_val := max_suffix + 100;
  
  IF target_val > (SELECT last_value FROM deal_identifier_seq) THEN
    PERFORM setval('deal_identifier_seq', target_val);
  END IF;
END;
$$;
