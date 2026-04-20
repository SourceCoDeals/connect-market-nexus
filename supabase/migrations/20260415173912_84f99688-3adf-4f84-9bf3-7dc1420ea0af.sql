
-- ============================================================
-- Helper: map firm_agreements status → deal_pipeline status
-- ============================================================
CREATE OR REPLACE FUNCTION public.map_agreement_status_to_deal(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'signed' THEN 'signed'
    WHEN 'sent' THEN 'sent'
    WHEN 'declined' THEN 'declined'
    WHEN 'expired' THEN 'declined'
    WHEN 'redlined' THEN 'sent'
    WHEN 'not_started' THEN 'not_sent'
    ELSE 'not_sent'
  END;
$$;

-- ============================================================
-- 1. Trigger function: sync firm_agreements → connection_requests + deal_pipeline
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_firm_agreement_to_downstream()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_nda_status text;
  v_deal_fee_status text;
BEGIN
  IF (
    OLD.nda_signed IS DISTINCT FROM NEW.nda_signed OR
    OLD.nda_status IS DISTINCT FROM NEW.nda_status OR
    OLD.nda_signed_at IS DISTINCT FROM NEW.nda_signed_at OR
    OLD.fee_agreement_signed IS DISTINCT FROM NEW.fee_agreement_signed OR
    OLD.fee_agreement_status IS DISTINCT FROM NEW.fee_agreement_status OR
    OLD.fee_agreement_signed_at IS DISTINCT FROM NEW.fee_agreement_signed_at
  ) THEN
    -- Sync NDA fields to connection_requests
    UPDATE public.connection_requests
    SET
      lead_nda_signed = COALESCE(NEW.nda_signed, false),
      lead_nda_signed_at = NEW.nda_signed_at,
      lead_nda_signed_by = NEW.nda_signed_by,
      updated_at = now()
    WHERE firm_id = NEW.id
      AND (
        COALESCE(lead_nda_signed, false) IS DISTINCT FROM COALESCE(NEW.nda_signed, false)
        OR lead_nda_signed_at IS DISTINCT FROM NEW.nda_signed_at
      );

    -- Sync Fee Agreement fields to connection_requests
    UPDATE public.connection_requests
    SET
      lead_fee_agreement_signed = COALESCE(NEW.fee_agreement_signed, false),
      lead_fee_agreement_signed_at = NEW.fee_agreement_signed_at,
      lead_fee_agreement_signed_by = NEW.fee_agreement_signed_by,
      updated_at = now()
    WHERE firm_id = NEW.id
      AND (
        COALESCE(lead_fee_agreement_signed, false) IS DISTINCT FROM COALESCE(NEW.fee_agreement_signed, false)
        OR lead_fee_agreement_signed_at IS DISTINCT FROM NEW.fee_agreement_signed_at
      );

    -- Map statuses for deal_pipeline constraint compatibility
    v_deal_nda_status := public.map_agreement_status_to_deal(NEW.nda_status);
    v_deal_fee_status := public.map_agreement_status_to_deal(NEW.fee_agreement_status);

    -- Sync to deal_pipeline via connection_request_id
    UPDATE public.deal_pipeline dp
    SET
      nda_status = v_deal_nda_status,
      fee_agreement_status = v_deal_fee_status,
      updated_at = now()
    FROM public.connection_requests cr
    WHERE cr.firm_id = NEW.id
      AND dp.connection_request_id = cr.id
      AND (
        dp.nda_status IS DISTINCT FROM v_deal_nda_status
        OR dp.fee_agreement_status IS DISTINCT FROM v_deal_fee_status
      );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger (drop first to be idempotent)
DROP TRIGGER IF EXISTS trg_sync_firm_agreement_downstream ON public.firm_agreements;
CREATE TRIGGER trg_sync_firm_agreement_downstream
  AFTER UPDATE ON public.firm_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_firm_agreement_to_downstream();

-- ============================================================
-- 2. Backfill: sync all existing mismatched connection_requests
-- ============================================================
UPDATE public.connection_requests cr
SET
  lead_nda_signed = COALESCE(fa.nda_signed, false),
  lead_nda_signed_at = fa.nda_signed_at,
  lead_nda_signed_by = fa.nda_signed_by,
  lead_fee_agreement_signed = COALESCE(fa.fee_agreement_signed, false),
  lead_fee_agreement_signed_at = fa.fee_agreement_signed_at,
  lead_fee_agreement_signed_by = fa.fee_agreement_signed_by,
  updated_at = now()
FROM public.firm_agreements fa
WHERE fa.id = cr.firm_id
  AND (
    COALESCE(cr.lead_nda_signed, false) IS DISTINCT FROM COALESCE(fa.nda_signed, false)
    OR COALESCE(cr.lead_fee_agreement_signed, false) IS DISTINCT FROM COALESCE(fa.fee_agreement_signed, false)
  );

-- Backfill deal_pipeline rows via connection_request_id (with status mapping)
UPDATE public.deal_pipeline dp
SET
  nda_status = public.map_agreement_status_to_deal(fa.nda_status),
  fee_agreement_status = public.map_agreement_status_to_deal(fa.fee_agreement_status),
  updated_at = now()
FROM public.connection_requests cr
JOIN public.firm_agreements fa ON fa.id = cr.firm_id
WHERE dp.connection_request_id = cr.id
  AND (
    dp.nda_status IS DISTINCT FROM public.map_agreement_status_to_deal(fa.nda_status)
    OR dp.fee_agreement_status IS DISTINCT FROM public.map_agreement_status_to_deal(fa.fee_agreement_status)
  );
