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

-- 4. Unified contact timeline view
CREATE OR REPLACE VIEW unified_contact_timeline AS

-- PhoneBurner call activities
SELECT
  ca.id,
  ca.contact_id,
  ca.contact_email,
  'phoneburner'::text as source,
  ca.activity_type as event_type,
  COALESCE(ca.disposition_label, ca.call_outcome, 'Call') as title,
  ca.disposition_notes as body_preview,
  ca.call_started_at as event_at,
  ca.created_at,
  ca.listing_id,
  NULL::uuid as deal_id,
  jsonb_build_object(
    'duration_seconds', ca.call_duration_seconds,
    'recording_url', ca.recording_url,
    'disposition_code', ca.disposition_code,
    'user_name', ca.user_name
  ) as metadata
FROM contact_activities ca

UNION ALL

-- Outlook emails (matched)
SELECT
  em.id,
  em.contact_id,
  em.from_address as contact_email,
  'outlook'::text as source,
  CASE em.direction WHEN 'outbound' THEN 'email_sent' ELSE 'email_received' END as event_type,
  em.subject as title,
  NULL::text as body_preview,
  em.sent_at as event_at,
  em.created_at,
  NULL::uuid as listing_id,
  em.deal_id,
  jsonb_build_object(
    'direction', em.direction,
    'to_addresses', em.to_addresses,
    'has_attachments', em.has_attachments
  ) as metadata
FROM email_messages em

UNION ALL

-- SmartLead reply inbox
SELECT
  sri.id,
  NULL::uuid as contact_id,
  sri.to_email as contact_email,
  'smartlead'::text as source,
  'reply_received'::text as event_type,
  sri.subject as title,
  sri.preview_text as body_preview,
  sri.time_replied as event_at,
  sri.created_at,
  NULL::uuid as listing_id,
  sri.linked_deal_id as deal_id,
  jsonb_build_object(
    'from_email', sri.from_email,
    'classification', sri.ai_category,
    'campaign_name', sri.campaign_name
  ) as metadata
FROM smartlead_reply_inbox sri;

-- 5. Index for faster timeline queries per contact
CREATE INDEX IF NOT EXISTS idx_contact_activities_contact_id_not_null
  ON contact_activities(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_messages_contact_id
  ON email_messages(contact_id);
