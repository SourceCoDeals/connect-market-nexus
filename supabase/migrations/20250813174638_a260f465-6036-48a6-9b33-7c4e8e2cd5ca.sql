-- Add trigger to automatically generate deal identifiers for new listings
-- This will only generate identifiers for listings that don't already have one

CREATE TRIGGER auto_generate_deal_identifier_trigger
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_deal_identifier();

-- Update existing listings without deal identifiers to have them generated
-- This preserves existing identifiers and continues the sequence
UPDATE public.listings 
SET deal_identifier = public.generate_deal_identifier()
WHERE deal_identifier IS NULL OR deal_identifier = '';

-- Add a comment to document this feature
COMMENT ON TRIGGER auto_generate_deal_identifier_trigger ON public.listings 
IS 'Automatically generates unique deal identifiers (SCO-YYYY-XXX format) for new listings when deal_identifier is NULL';