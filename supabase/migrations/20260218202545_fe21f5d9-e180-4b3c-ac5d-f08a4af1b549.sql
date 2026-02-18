
-- 1. Duplicate prevention trigger for valuation_leads
CREATE OR REPLACE FUNCTION public.prevent_valuation_lead_duplicates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-mark as duplicate if a non-excluded lead with same email+calculator_type exists
  IF EXISTS (
    SELECT 1 FROM public.valuation_leads
    WHERE email = NEW.email
      AND calculator_type = NEW.calculator_type
      AND excluded = false
      AND id != NEW.id
  ) THEN
    NEW.excluded := true;
    NEW.exclusion_reason := 'duplicate';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_valuation_lead_duplicates ON public.valuation_leads;

CREATE TRIGGER trg_prevent_valuation_lead_duplicates
  BEFORE INSERT ON public.valuation_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_valuation_lead_duplicates();
