-- ============================================================================
-- MIGRATION: Mirror trigger — remarketing_buyer_contacts → contacts
-- ============================================================================
-- Part of the Data Relationship Audit — ensures any legacy code paths that
-- still insert into remarketing_buyer_contacts also create/update a
-- corresponding row in the unified contacts table.
--
-- This is a safety net for the transition period. The primary app code is
-- being updated to write directly to contacts, but this trigger catches
-- any remaining writes to the legacy table.
--
-- SAFETY:
--   - ADDITIVE ONLY: New trigger function, no schema changes.
--   - NO DATA LOSS: Original insert into remarketing_buyer_contacts proceeds.
--   - ZERO DOWNTIME: Trigger is added without locking.
-- ============================================================================


CREATE OR REPLACE FUNCTION public.mirror_rbc_to_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_firm_id UUID;
BEGIN
  -- Split name into first/last
  v_first_name := COALESCE(NULLIF(TRIM(split_part(NEW.name, ' ', 1)), ''), NEW.name, 'Unknown');
  v_last_name := CASE
    WHEN position(' ' IN COALESCE(NEW.name, '')) > 0
    THEN TRIM(substring(NEW.name FROM position(' ' IN NEW.name) + 1))
    ELSE ''
  END;

  -- Look up the firm_id from the parent remarketing_buyers record
  SELECT rb.marketplace_firm_id INTO v_firm_id
  FROM public.remarketing_buyers rb
  WHERE rb.id = NEW.buyer_id;

  -- Upsert into contacts (deduplicate by email for buyer contacts)
  INSERT INTO public.contacts
    (first_name, last_name, email, phone, linkedin_url, title,
     contact_type, remarketing_buyer_id, firm_id,
     is_primary_at_firm, source, notes, created_at)
  VALUES
    (v_first_name, v_last_name,
     NULLIF(TRIM(lower(NEW.email)), ''),
     NULLIF(TRIM(NEW.phone), ''),
     NULLIF(TRIM(NEW.linkedin_url), ''),
     NULLIF(TRIM(NEW.role), ''),
     'buyer',
     NEW.buyer_id,
     v_firm_id,
     COALESCE(NEW.is_primary, false),
     'remarketing_mirror',
     NEW.notes,
     COALESCE(NEW.created_at, now()))
  ON CONFLICT (lower(email))
    WHERE contact_type = 'buyer' AND email IS NOT NULL AND archived = false
  DO UPDATE SET
    remarketing_buyer_id = COALESCE(contacts.remarketing_buyer_id, EXCLUDED.remarketing_buyer_id),
    firm_id = COALESCE(contacts.firm_id, EXCLUDED.firm_id),
    is_primary_at_firm = contacts.is_primary_at_firm OR EXCLUDED.is_primary_at_firm,
    phone = COALESCE(EXCLUDED.phone, contacts.phone),
    linkedin_url = COALESCE(EXCLUDED.linkedin_url, contacts.linkedin_url),
    title = COALESCE(EXCLUDED.title, contacts.title),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_rbc_to_contacts ON public.remarketing_buyer_contacts;
CREATE TRIGGER trg_mirror_rbc_to_contacts
  AFTER INSERT ON public.remarketing_buyer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_rbc_to_contacts();


-- ============================================================================
-- Summary:
--   1 new trigger function: mirror_rbc_to_contacts
--   1 new trigger: trg_mirror_rbc_to_contacts (AFTER INSERT)
--   Mirrors any insert into remarketing_buyer_contacts → contacts table
--   Uses ON CONFLICT to deduplicate by email for buyer contacts
-- ============================================================================
