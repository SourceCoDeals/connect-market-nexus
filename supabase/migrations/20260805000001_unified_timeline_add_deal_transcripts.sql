-- ============================================================================
-- unified_contact_timeline: add seller-side deal_transcripts arm
-- ============================================================================
-- The view currently UNIONs five buyer-/lead-side sources plus Fireflies
-- meetings via buyer_transcripts. Seller-side calls and meetings — stored in
-- deal_transcripts — are absent, so:
--
--   - useContactCombinedHistory misses any seller-side touch
--   - get_firm_activity returns nothing for seller-side activity
--   - per-firm touchpoint counts under-report
--
-- Fix: add a seventh UNION ALL arm reading deal_transcripts. Seller-side
-- transcripts are produced by Fireflies (meetings) and PhoneBurner (call
-- transcripts that already have their canonical row in contact_activities,
-- but whose summarized transcript_text lives here too) and occasionally by
-- manual upload. The arm exposes them on listing_id, leaving deal_id,
-- remarketing_buyer_id, contact_id, contact_email NULL — matching the
-- shape of the existing arms exactly.
--
-- Note on the prompt-spec divergence: the original prompt suggested a
-- LEFT JOIN buyer_transcripts bt ON bt.id = dt.id to source a title.
-- That join is a no-op because the two tables generate independent UUIDs.
-- deal_transcripts already has a `title` column, so we use it directly
-- and fall back to the fixed string only when null/empty.
--
-- Functions that depend on the view's row type or body must be dropped
-- and recreated:
--   - get_firm_activity(uuid, text[])      RETURNS SETOF unified_contact_timeline
--   - get_firm_touchpoint_counts(uuid[])   references the view in its body
--
-- Both are recreated below verbatim from their last definitions
-- (20260720000000 and 20260722000000 respectively).
--
-- security_invoker = true is re-applied to match the per-view setting from
-- 20260420210000_demote_security_definer_views.sql.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_firm_touchpoint_counts(uuid[]);
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

-- Fireflies meetings (buyer-side: matched on participant email)
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
FROM buyer_transcripts bt

UNION ALL

-- Seller-side transcripts (Fireflies meetings + PhoneBurner call transcripts
-- + manual uploads, all keyed on listing_id rather than buyer_id)
SELECT
  dt.id,
  NULL::uuid                                          AS contact_id,
  NULL::uuid                                          AS remarketing_buyer_id,
  NULL::text                                          AS contact_email,
  CASE dt.source
    WHEN 'phoneburner' THEN 'phoneburner'::text
    WHEN 'fireflies'   THEN 'fireflies'::text
    ELSE COALESCE(dt.source, 'unknown')::text
  END                                                 AS source,
  CASE dt.source
    WHEN 'phoneburner' THEN 'call'::text
    ELSE 'meeting'::text
  END                                                 AS channel,
  CASE dt.source
    WHEN 'phoneburner' THEN 'CALL_TRANSCRIBED'::text
    ELSE 'MEETING_RECORDED'::text
  END                                                 AS event_type,
  COALESCE(NULLIF(dt.title, ''), 'Seller-side transcript') AS title,
  LEFT(dt.transcript_text, 500)                       AS body_preview,
  COALESCE(dt.call_date, dt.processed_at, dt.created_at) AS event_at,
  dt.created_at,
  dt.listing_id,
  NULL::uuid                                          AS deal_id,
  NULL::text                                          AS campaign_name,
  NULL::text                                          AS campaign_id,
  NULL::text                                          AS direction,
  jsonb_build_object(
    'duration_minutes',    dt.duration_minutes,
    'match_type',          dt.match_type,
    'extraction_status',   dt.extraction_status,
    'contact_activity_id', dt.contact_activity_id,
    'transcript_url',      dt.transcript_url,
    'recording_url',       dt.recording_url,
    'participants',        dt.participants,
    'meeting_attendees',   dt.meeting_attendees
  )                                                   AS metadata
FROM deal_transcripts dt
WHERE dt.has_content IS NOT FALSE;

-- Match the per-view security setting applied in
-- 20260420210000_demote_security_definer_views.sql.
ALTER VIEW public.unified_contact_timeline SET (security_invoker = true);

-- Index for the new arm to keep firm/domain queries fast against it. The
-- existing buyer-side indexes already cover the other arms.
CREATE INDEX IF NOT EXISTS idx_deal_transcripts_listing_event_at
  ON public.deal_transcripts (listing_id, (COALESCE(call_date, processed_at, created_at)) DESC)
  WHERE has_content IS NOT FALSE;

-- Recreate get_firm_activity verbatim against the rebuilt view's row type.
-- Body unchanged from 20260720000000_domain_contact_tracking_phase2.sql /
-- 20260416120000_unified_timeline_add_campaign_id.sql.
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

COMMENT ON FUNCTION public.get_firm_activity(uuid, text[]) IS
  'Phase 2 of domain-based contact tracking. Returns up to 500 unified_contact_timeline rows matching either the given buyer_id OR any of the provided domains. Used to surface all activity across a firm, not just activity for a single contact.';

GRANT EXECUTE ON FUNCTION public.get_firm_activity(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_firm_activity(uuid, text[]) TO service_role;

-- Recreate get_firm_touchpoint_counts verbatim. Body unchanged from
-- 20260722000000_domain_contact_tracking_phase5.sql; only its dependency on
-- the dropped view forces the recreate.
CREATE OR REPLACE FUNCTION public.get_firm_touchpoint_counts(
  p_buyer_ids uuid[]
)
RETURNS TABLE (
  buyer_id uuid,
  firm_touchpoint_count bigint,
  firm_domain_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  buyer_domains AS (
    SELECT
      b.id AS buyer_id,
      COALESCE(
        array_agg(lower(fda.domain)) FILTER (WHERE fda.domain IS NOT NULL),
        ARRAY[]::TEXT[]
      ) AS domains
    FROM public.buyers b
    LEFT JOIN public.firm_domain_aliases fda ON fda.firm_id = b.marketplace_firm_id
    WHERE b.id = ANY(p_buyer_ids)
    GROUP BY b.id
  ),
  touchpoints AS (
    SELECT DISTINCT bd.buyer_id, uct.id AS timeline_id
    FROM buyer_domains bd
    JOIN public.unified_contact_timeline uct ON (
      uct.remarketing_buyer_id = bd.buyer_id
      OR (
        cardinality(bd.domains) > 0
        AND uct.contact_email IS NOT NULL
        AND uct.contact_email <> ''
        AND lower(split_part(uct.contact_email, '@', 2)) = ANY(bd.domains)
      )
    )
  )
  SELECT
    bd.buyer_id,
    COALESCE(COUNT(tp.timeline_id), 0) AS firm_touchpoint_count,
    cardinality(bd.domains) AS firm_domain_count
  FROM buyer_domains bd
  LEFT JOIN touchpoints tp ON tp.buyer_id = bd.buyer_id
  GROUP BY bd.buyer_id, bd.domains;
$$;

COMMENT ON FUNCTION public.get_firm_touchpoint_counts(uuid[]) IS
  'Phase 5 of domain-based contact tracking. Batch version of get_firm_activity — returns per-buyer firm touchpoint counts for every id in p_buyer_ids. Used by the deal matching page to display a "firm touchpoints" metric on each buyer card without firing one RPC per card.';

GRANT EXECUTE ON FUNCTION public.get_firm_touchpoint_counts(uuid[])
  TO authenticated, service_role;
