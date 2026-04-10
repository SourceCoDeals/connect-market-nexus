-- Keep deal_pipeline.nda_status and fee_agreement_status in sync with the
-- stage the deal is moved into. Previously a drag from "Approved" → "NDA Signed"
-- would leave nda_status='not_sent' silently, creating conflicting state that
-- the data-room tab and RLS policies downstream relied on.
--
-- This trigger is STAGE → FLAG (one-directional). Reverse sync (flipping a
-- flag auto-moving the stage) is intentionally not implemented: admins routinely
-- toggle NDA/Fee status mid-stage without intending a stage change.

CREATE OR REPLACE FUNCTION public.sync_deal_flags_from_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stage_name TEXT;
BEGIN
  -- Only react when the stage actually changes
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO new_stage_name FROM public.deal_stages WHERE id = NEW.stage_id;
  IF new_stage_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- NDA synchronization
  IF new_stage_name ILIKE '%NDA Signed%' AND NEW.nda_status IS DISTINCT FROM 'signed' THEN
    NEW.nda_status := 'signed';
  ELSIF new_stage_name ILIKE '%NDA Sent%' AND NEW.nda_status IN ('not_sent', NULL) THEN
    NEW.nda_status := 'sent';
  END IF;

  -- Fee agreement synchronization
  IF new_stage_name ILIKE '%Fee Agreement Signed%'
     AND NEW.fee_agreement_status IS DISTINCT FROM 'signed' THEN
    NEW.fee_agreement_status := 'signed';
  ELSIF new_stage_name ILIKE '%Fee Agreement Sent%'
        AND NEW.fee_agreement_status IN ('not_sent', NULL) THEN
    NEW.fee_agreement_status := 'sent';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deal_flags_from_stage ON public.deal_pipeline;
CREATE TRIGGER trg_sync_deal_flags_from_stage
BEFORE UPDATE OF stage_id ON public.deal_pipeline
FOR EACH ROW
EXECUTE FUNCTION public.sync_deal_flags_from_stage();

COMMENT ON FUNCTION public.sync_deal_flags_from_stage() IS
  'Keep deal_pipeline NDA/fee agreement status in sync with the pipeline stage. Forward-only (stage → flag).';
