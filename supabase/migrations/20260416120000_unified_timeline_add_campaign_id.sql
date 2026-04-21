-- =============================================================================
-- unified_contact_timeline: expose campaign_id
-- =============================================================================
-- The view exposed `campaign_name` but not `campaign_id`, so the UI could only
-- filter / link by the human-readable name. When a campaign gets renamed
-- mid-flight the filter breaks silently. Add the canonical ID as a top-level
-- column so hooks can deep-link / group / filter by it.
--
-- campaign_id is typed as TEXT so smartlead (BIGINT) and heyreach (BIGINT) IDs
-- can coexist in the same column; consumers can cast if needed. NULL for
-- phoneburner / outlook / fireflies rows (no campaign concept).
--
-- All other columns preserved verbatim so existing consumers keep working.
-- =============================================================================

-- get_firm_activity returns SETOF unified_contact_timeline, so it blocks the
-- view drop. Drop it first, recreate at the bottom of this migration.
DROP FUNCTION IF EXISTS public.get_firm_activity(uuid, text[]);

DROP VIEW IF EXISTS public.unified_contact_timeline;

CREATE VIEW public.unified_contact_timeline AS

-- PhoneBurner call activities
SELECT
  ca.id, ca.contact_id, ca.remarketing_buyer_id, ca.contact_email,
  'phoneburner'::text AS source, 'call'::text AS channel,
  ca.activity_type AS event_type,
  COALESCE(ca.disposition_label, ca.call_outcome, 'Call'::text) AS title,
  ca.disposition_notes AS body_preview,
  ca.call_started_at AS event_at, ca.created_at, ca.listing_id, NULL::uuid AS deal_id,
  NULL::text AS campaign_name,
  NULL::text AS campaign_id,
  ca.call_direction AS direction,
  jsonb_build_object(
    'duration_seconds', ca.call_duration_seconds, 'talk_time_seconds', ca.talk_time_seconds,
    'recording_url', ca.recording_url, 'recording_url_public', ca.recording_url_public,
    'call_transcript', ca.call_transcript, 'disposition_code', ca.disposition_code,
    'disposition_label', ca.disposition_label, 'disposition_notes', ca.disposition_notes,
    'call_outcome', ca.call_outcome, 'call_connected', ca.call_connected,
    'phoneburner_status', ca.phoneburner_status, 'contact_notes', ca.contact_notes,
    'callback_scheduled_date', ca.callback_scheduled_date, 'user_name', ca.user_name
  ) AS metadata
FROM contact_activities ca

UNION ALL

-- Outlook emails
SELECT
  em.id, em.contact_id, c.remarketing_buyer_id, em.from_address AS contact_email,
  'outlook'::text, 'email'::text,
  CASE em.direction WHEN 'outbound'::email_direction THEN 'EMAIL_SENT'::text ELSE 'EMAIL_RECEIVED'::text END,
  em.subject, NULL::text, em.sent_at, em.created_at, NULL::uuid, em.deal_id,
  NULL::text, NULL::text, (em.direction)::text,
  jsonb_build_object('to_addresses', em.to_addresses, 'has_attachments', em.has_attachments, 'from_address', em.from_address)
FROM email_messages em
LEFT JOIN contacts c ON c.id = em.contact_id

UNION ALL

-- SmartLead messages
SELECT
  sm.id, sm.contact_id, sm.remarketing_buyer_id, sm.from_address AS contact_email,
  'smartlead'::text, 'email'::text, upper(sm.event_type),
  sm.subject, sm.body_text, sm.sent_at, sm.created_at, sm.listing_id, NULL::uuid,
  sc.name AS campaign_name,
  sm.smartlead_campaign_id::text AS campaign_id,
  sm.direction,
  jsonb_build_object(
    'sequence_number', sm.sequence_number,
    'lead_email', sm.from_address,
    'smartlead_campaign_id', sm.smartlead_campaign_id
  )
FROM smartlead_messages sm
LEFT JOIN smartlead_campaigns sc ON sc.smartlead_campaign_id = sm.smartlead_campaign_id

UNION ALL

-- SmartLead reply inbox
SELECT
  sri.id, NULL::uuid, NULL::uuid, sri.to_email AS contact_email,
  'smartlead'::text, 'email'::text, 'REPLIED'::text,
  sri.subject, sri.preview_text, sri.time_replied, sri.created_at, NULL::uuid, sri.linked_deal_id,
  sri.campaign_name,
  sri.campaign_id::text AS campaign_id,
  'inbound'::text,
  jsonb_build_object(
    'from_email', sri.from_email,
    'classification', sri.ai_category,
    'campaign_name', sri.campaign_name,
    'lead_email', sri.sl_lead_email
  )
FROM smartlead_reply_inbox sri

UNION ALL

-- HeyReach messages
SELECT
  hm.id, hm.contact_id, hm.remarketing_buyer_id, hm.from_address AS contact_email,
  'heyreach'::text, 'linkedin'::text, upper(hm.event_type),
  hm.subject, hm.body_text, hm.sent_at, hm.created_at, hm.listing_id, NULL::uuid,
  hc.name AS campaign_name,
  hm.heyreach_campaign_id::text AS campaign_id,
  hm.direction,
  jsonb_build_object(
    'sequence_number', hm.sequence_number,
    'linkedin_url', hm.linkedin_url,
    'heyreach_campaign_id', hm.heyreach_campaign_id
  )
FROM heyreach_messages hm
LEFT JOIN heyreach_campaigns hc ON hc.heyreach_campaign_id = hm.heyreach_campaign_id

UNION ALL

-- Fireflies meetings
SELECT
  bt.id, NULL::uuid, bt.buyer_id AS remarketing_buyer_id, NULL::text AS contact_email,
  'fireflies'::text, 'meeting'::text, 'MEETING_RECORDED'::text,
  bt.title, bt.summary AS body_preview, bt.call_date AS event_at, bt.created_at,
  NULL::uuid, NULL::uuid,
  NULL::text AS campaign_name, NULL::text AS campaign_id, NULL::text AS direction,
  jsonb_build_object(
    'duration_minutes', bt.duration_minutes,
    'participants', bt.participants,
    'transcript_url', bt.transcript_url,
    'key_points', bt.key_points,
    'action_items', bt.action_items
  )
FROM buyer_transcripts bt;

-- Recreate get_firm_activity against the rebuilt view (same body as before —
-- pg_get_functiondef output captured pre-migration).
CREATE OR REPLACE FUNCTION public.get_firm_activity(
  p_buyer_id uuid DEFAULT NULL::uuid,
  p_domains text[] DEFAULT '{}'::text[]
)
RETURNS SETOF public.unified_contact_timeline
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT *
  FROM public.unified_contact_timeline
  WHERE
    (p_buyer_id IS NOT NULL AND remarketing_buyer_id = p_buyer_id)
    OR
    (
      cardinality(p_domains) > 0
      AND contact_email IS NOT NULL
      AND contact_email <> ''
      AND lower(split_part(contact_email, '@', 2)) = ANY(
        SELECT lower(d) FROM unnest(p_domains) AS d WHERE d IS NOT NULL AND d <> ''
      )
    )
  ORDER BY event_at DESC NULLS LAST
  LIMIT 500;
$$;
