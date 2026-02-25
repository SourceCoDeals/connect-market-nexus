-- Migration: 20260328000000_contact_history_tracking.sql
-- Contact History Tracker: tracks all outreach activities (emails, calls, LinkedIn)
-- across SmartLead, PhoneBurner, and HeyReach into unified per-contact history tables.

-- ═══════════════════════════════════════════════════════════════════
-- Table 1: contact_email_history
-- Tracks email sends, opens, clicks, replies from SmartLead
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contact_email_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  smartlead_campaign_id text,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  sent_at timestamptz NOT NULL,
  sent_by text NOT NULL,
  opened_at timestamptz,
  opened_count integer DEFAULT 0,
  clicked_at timestamptz,
  clicked_count integer DEFAULT 0,
  replied_at timestamptz,
  reply_text text,
  reply_sentiment text CHECK (reply_sentiment IN ('positive', 'neutral', 'negative')),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_contact_email_contact ON contact_email_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_email_sent ON contact_email_history(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_email_listing ON contact_email_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_contact_email_recipient ON contact_email_history(recipient_email);

-- ═══════════════════════════════════════════════════════════════════
-- Table 2: contact_call_history
-- Tracks calls, durations, dispositions, notes from PhoneBurner
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contact_call_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  phoneburner_call_id text,
  phone_number text NOT NULL,
  called_at timestamptz NOT NULL,
  called_by text NOT NULL,
  duration_seconds integer DEFAULT 0,
  disposition text NOT NULL CHECK (
    disposition IN ('connected', 'voicemail', 'no_answer', 'wrong_number', 'do_not_call')
  ),
  call_notes text,
  recording_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_contact_call_contact ON contact_call_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_call_datetime ON contact_call_history(called_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_call_listing ON contact_call_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_contact_call_phone ON contact_call_history(phone_number);

-- ═══════════════════════════════════════════════════════════════════
-- Table 3: contact_linkedin_history
-- Tracks LinkedIn connection requests, messages, replies from HeyReach
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contact_linkedin_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  activity_type text NOT NULL CHECK (
    activity_type IN (
      'connection_request_sent', 'connection_accepted',
      'message_sent', 'message_read', 'message_replied',
      'inmail_sent', 'inmail_received',
      'profile_viewed', 'followed', 'liked_post'
    )
  ),
  linkedin_url text,
  activity_timestamp timestamptz NOT NULL,
  message_text text,
  response_text text,
  response_sentiment text CHECK (response_sentiment IN ('positive', 'neutral', 'negative')),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_contact_linkedin_contact ON contact_linkedin_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_linkedin_timestamp ON contact_linkedin_history(activity_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_contact_linkedin_listing ON contact_linkedin_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_contact_linkedin_url ON contact_linkedin_history(linkedin_url);

-- ═══════════════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE contact_email_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_call_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_linkedin_history ENABLE ROW LEVEL SECURITY;

-- Policies: Admins can do everything (same pattern as buyer_introductions)
DROP POLICY IF EXISTS contact_email_history_admin_all ON contact_email_history;
CREATE POLICY contact_email_history_admin_all ON contact_email_history
  FOR ALL
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS contact_call_history_admin_all ON contact_call_history;
CREATE POLICY contact_call_history_admin_all ON contact_call_history
  FOR ALL
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS contact_linkedin_history_admin_all ON contact_linkedin_history;
CREATE POLICY contact_linkedin_history_admin_all ON contact_linkedin_history
  FOR ALL
  USING (is_admin(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════
-- Views: Aggregated contact history summary per listing
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW contact_history_summary AS
SELECT
  c.id as contact_id,
  COALESCE(c.first_name || ' ' || c.last_name, 'Unknown') as contact_name,
  c.email as contact_email,
  c.listing_id,
  -- Email stats
  COALESCE(email_stats.total_emails, 0) as total_emails,
  COALESCE(email_stats.emails_opened, 0) as emails_opened,
  COALESCE(email_stats.emails_replied, 0) as emails_replied,
  email_stats.last_email_at,
  -- Call stats
  COALESCE(call_stats.total_calls, 0) as total_calls,
  COALESCE(call_stats.calls_connected, 0) as calls_connected,
  call_stats.last_call_at,
  -- LinkedIn stats
  COALESCE(li_stats.total_linkedin, 0) as total_linkedin,
  COALESCE(li_stats.linkedin_replies, 0) as linkedin_replies,
  li_stats.last_linkedin_at,
  -- Computed: days since last contact (across all channels)
  EXTRACT(DAY FROM now() - GREATEST(
    email_stats.last_email_at,
    call_stats.last_call_at,
    li_stats.last_linkedin_at
  ))::integer as days_since_last_contact,
  -- Computed: last contact channel
  CASE
    WHEN GREATEST(
      email_stats.last_email_at,
      call_stats.last_call_at,
      li_stats.last_linkedin_at
    ) = email_stats.last_email_at THEN 'email'
    WHEN GREATEST(
      email_stats.last_email_at,
      call_stats.last_call_at,
      li_stats.last_linkedin_at
    ) = call_stats.last_call_at THEN 'call'
    WHEN GREATEST(
      email_stats.last_email_at,
      call_stats.last_call_at,
      li_stats.last_linkedin_at
    ) = li_stats.last_linkedin_at THEN 'linkedin'
  END as last_contact_channel
FROM contacts c
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) as total_emails,
    COUNT(*) FILTER (WHERE opened_count > 0) as emails_opened,
    COUNT(*) FILTER (WHERE replied_at IS NOT NULL) as emails_replied,
    MAX(sent_at) as last_email_at
  FROM contact_email_history eh
  WHERE eh.contact_id = c.id AND eh.archived_at IS NULL
) email_stats ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE disposition = 'connected') as calls_connected,
    MAX(called_at) as last_call_at
  FROM contact_call_history ch
  WHERE ch.contact_id = c.id AND ch.archived_at IS NULL
) call_stats ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) as total_linkedin,
    COUNT(*) FILTER (WHERE activity_type IN ('message_replied', 'inmail_received')) as linkedin_replies,
    MAX(activity_timestamp) as last_linkedin_at
  FROM contact_linkedin_history lh
  WHERE lh.contact_id = c.id AND lh.archived_at IS NULL
) li_stats ON true
WHERE c.archived = false;

-- Per-listing contact history summary
CREATE OR REPLACE VIEW listing_contact_history_summary AS
SELECT
  l.id as listing_id,
  COALESCE(l.internal_company_name, l.title) as company_name,
  COUNT(DISTINCT chs.contact_id) FILTER (WHERE chs.total_emails + chs.total_calls + chs.total_linkedin > 0) as contacts_with_activity,
  SUM(chs.total_emails) as total_emails,
  SUM(chs.total_calls) as total_calls,
  SUM(chs.total_linkedin) as total_linkedin,
  MIN(chs.days_since_last_contact) as days_since_last_contact
FROM listings l
LEFT JOIN contact_history_summary chs ON chs.listing_id = l.id
WHERE l.deleted_at IS NULL
GROUP BY l.id, l.internal_company_name, l.title
ORDER BY COALESCE(l.internal_company_name, l.title);
