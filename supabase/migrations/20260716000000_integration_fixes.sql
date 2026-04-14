-- Integration fixes from audit: April 2026
-- Fixes orphaned activities, Outlook polling, unified timeline

-- 1. Add initial_sync_complete to email_connections (Outlook polling mode needs it)
ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS initial_sync_complete boolean DEFAULT false;

-- 2. Rematch function for orphaned contact_activities
CREATE OR REPLACE FUNCTION rematch_orphaned_activities()
RETURNS TABLE(activities_matched bigint, outlook_matched bigint, smartlead_matched bigint, heyreach_matched bigint) AS $$
DECLARE
  v_activities bigint := 0;
  v_outlook bigint := 0;
  v_smartlead bigint := 0;
  v_heyreach bigint := 0;
BEGIN
  -- Match contact_activities by email
  WITH matched AS (
    UPDATE contact_activities ca
    SET contact_id = c.id
    FROM contacts c
    WHERE ca.contact_id IS NULL
      AND ca.contact_email IS NOT NULL
      AND lower(ca.contact_email) = lower(c.email)
    RETURNING ca.id
  )
  SELECT count(*) INTO v_activities FROM matched;

  -- Match by listing main_contact_email
  WITH matched AS (
    UPDATE contact_activities ca
    SET contact_id = c.id
    FROM listings l
    JOIN contacts c ON lower(c.email) = lower(l.main_contact_email)
    WHERE ca.contact_id IS NULL
      AND ca.listing_id IS NOT NULL
      AND ca.listing_id = l.id
      AND l.main_contact_email IS NOT NULL
    RETURNING ca.id
  )
  SELECT v_activities + count(*) INTO v_activities FROM matched;

  -- Promote outlook_unmatched_emails where contact now exists
  WITH matched AS (
    UPDATE outlook_unmatched_emails oue
    SET matched_at = now()
    FROM contacts c
    WHERE oue.matched_at IS NULL
      AND lower(c.email) = ANY(SELECT lower(unnest(oue.participant_emails)))
    RETURNING oue.id
  )
  SELECT count(*) INTO v_outlook FROM matched;

  RETURN QUERY SELECT v_activities, v_outlook, v_smartlead, v_heyreach;
END;
$$ LANGUAGE plpgsql;

-- 3. Auto-rematch trigger on new contact insert
CREATE OR REPLACE FUNCTION trg_contacts_rematch_activities()
RETURNS trigger AS $$
BEGIN
  UPDATE contact_activities
  SET contact_id = NEW.id
  WHERE contact_id IS NULL
    AND contact_email IS NOT NULL
    AND lower(contact_email) = lower(NEW.email);

  UPDATE outlook_unmatched_emails
  SET matched_at = now()
  WHERE matched_at IS NULL
    AND lower(NEW.email) = ANY(SELECT lower(unnest(participant_emails)));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contacts_rematch_on_insert ON contacts;
CREATE TRIGGER trg_contacts_rematch_on_insert
  AFTER INSERT ON contacts
  FOR EACH ROW
  WHEN (NEW.email IS NOT NULL)
  EXECUTE FUNCTION trg_contacts_rematch_activities();

-- 4. Unified contact timeline view is created in 20260716000001_enhanced_unified_timeline.sql

-- 5. Index for faster timeline queries per contact
CREATE INDEX IF NOT EXISTS idx_contact_activities_contact_id_not_null
  ON contact_activities(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_messages_contact_id
  ON email_messages(contact_id);
