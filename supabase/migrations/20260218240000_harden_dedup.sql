-- ============================================================
-- Harden valuation_leads dedup trigger against race conditions
-- ============================================================
-- The previous trigger uses a SELECT check under READ_COMMITTED isolation,
-- allowing two simultaneous inserts with the same email+calculator_type
-- to both pass the duplicate check. Fix with an advisory lock that
-- serializes inserts for the same email+calculator_type pair without
-- affecting unrelated inserts.

CREATE OR REPLACE FUNCTION prevent_valuation_lead_duplicates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.excluded = false THEN
    -- Advisory lock on hash of email+calculator_type to serialize concurrent inserts
    PERFORM pg_advisory_xact_lock(hashtext(LOWER(NEW.email) || '::' || NEW.calculator_type));

    IF EXISTS (
      SELECT 1 FROM valuation_leads
      WHERE LOWER(email) = LOWER(NEW.email)
        AND calculator_type = NEW.calculator_type
        AND excluded = false
        AND id != NEW.id
    ) THEN
      NEW.excluded := true;
      NEW.exclusion_reason := 'duplicate';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
