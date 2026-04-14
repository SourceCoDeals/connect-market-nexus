-- Enhanced unified_contact_timeline view with all sources, campaign names, buyer_id
-- Replaces the basic view from 20260716000000

DROP VIEW IF EXISTS unified_contact_timeline;

CREATE VIEW unified_contact_timeline AS

-- PhoneBurner call activities
SELECT
  ca.id, ca.contact_id, ca.remarketing_buyer_id, ca.contact_email,
  'phoneburner'::text as source, 'call'::text as channel,
  ca.activity_type as event_type,
  COALESCE(ca.disposition_label, ca.call_outcome, 'Call') as title,
  ca.disposition_notes as body_preview,
  ca.call_started_at as event_at, ca.created_at, ca.listing_id, NULL::uuid as deal_id,
  NULL::text as campaign_name, ca.call_direction as direction,
  jsonb_build_object(
    'duration_seconds', ca.call_duration_seconds, 'talk_time_seconds', ca.talk_time_seconds,
    'recording_url', ca.recording_url, 'recording_url_public', ca.recording_url_public,
    'call_transcript', ca.call_transcript, 'disposition_code', ca.disposition_code,
    'disposition_label', ca.disposition_label, 'disposition_notes', ca.disposition_notes,
    'call_outcome', ca.call_outcome, 'call_connected', ca.call_connected,
    'phoneburner_status', ca.phoneburner_status, 'contact_notes', ca.contact_notes,
    'callback_scheduled_date', ca.callback_scheduled_date, 'user_name', ca.user_name
  ) as metadata
FROM contact_activities ca

UNION ALL

-- Outlook emails
SELECT
  em.id, em.contact_id, c.remarketing_buyer_id, em.from_address,
  'outlook'::text, 'email'::text,
  CASE em.direction WHEN 'outbound' THEN 'EMAIL_SENT' ELSE 'EMAIL_RECEIVED' END,
  em.subject, NULL::text, em.sent_at, em.created_at, NULL::uuid, em.deal_id,
  NULL::text, em.direction::text,
  jsonb_build_object('to_addresses', em.to_addresses, 'has_attachments', em.has_attachments, 'from_address', em.from_address)
FROM email_messages em
LEFT JOIN contacts c ON c.id = em.contact_id

UNION ALL

-- SmartLead messages
SELECT
  sm.id, sm.contact_id, sm.remarketing_buyer_id, sm.from_address,
  'smartlead'::text, 'email'::text, UPPER(sm.event_type),
  sm.subject, sm.body_text, sm.sent_at, sm.created_at, sm.listing_id, NULL::uuid,
  sc.name, sm.direction,
  jsonb_build_object('sequence_number', sm.sequence_number, 'lead_email', sm.from_address, 'smartlead_campaign_id', sm.smartlead_campaign_id)
FROM smartlead_messages sm
LEFT JOIN smartlead_campaigns sc ON sc.smartlead_campaign_id = sm.smartlead_campaign_id

UNION ALL

-- SmartLead reply inbox
SELECT
  sri.id, NULL::uuid, NULL::uuid, sri.to_email,
  'smartlead'::text, 'email'::text, 'REPLIED'::text,
  sri.subject, sri.preview_text, sri.time_replied, sri.created_at, NULL::uuid, sri.linked_deal_id,
  sri.campaign_name, 'inbound'::text,
  jsonb_build_object('from_email', sri.from_email, 'classification', sri.ai_category, 'campaign_name', sri.campaign_name, 'lead_email', sri.sl_lead_email)
FROM smartlead_reply_inbox sri

UNION ALL

-- HeyReach messages
SELECT
  hm.id, hm.contact_id, hm.remarketing_buyer_id, hm.from_address,
  'heyreach'::text, 'linkedin'::text, UPPER(hm.event_type),
  hm.subject, hm.body_text, hm.sent_at, hm.created_at, hm.listing_id, NULL::uuid,
  hc.name, hm.direction,
  jsonb_build_object('sequence_number', hm.sequence_number, 'linkedin_url', hm.linkedin_url, 'heyreach_campaign_id', hm.heyreach_campaign_id)
FROM heyreach_messages hm
LEFT JOIN heyreach_campaigns hc ON hc.heyreach_campaign_id = hm.heyreach_campaign_id

UNION ALL

-- Fireflies meetings
SELECT
  bt.id, NULL::uuid, bt.buyer_id, NULL::text,
  'fireflies'::text, 'meeting'::text, 'MEETING_RECORDED'::text,
  bt.title, bt.summary, bt.call_date, bt.created_at, NULL::uuid, NULL::uuid,
  NULL::text, NULL::text,
  jsonb_build_object('duration_minutes', bt.duration_minutes, 'participants', bt.participants, 'transcript_url', bt.transcript_url, 'key_points', bt.key_points, 'action_items', bt.action_items)
FROM buyer_transcripts bt;

-- Indexes for view query performance
CREATE INDEX IF NOT EXISTS idx_heyreach_messages_buyer ON heyreach_messages(remarketing_buyer_id) WHERE remarketing_buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_transcripts_buyer ON buyer_transcripts(buyer_id);
