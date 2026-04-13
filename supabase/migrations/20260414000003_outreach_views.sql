-- =============================================================================
-- Outreach Summary Views
-- =============================================================================
-- Pre-joined rollup views that collapse common aggregation patterns used by
-- the 25 operator workflow scenarios. These are plain VIEWS (not materialized)
-- so they always reflect live data. They rely on the indexes defined in
-- 20260414000000_outreach_messages.sql for performance.
--
-- If query performance ever degrades, these can be converted to materialized
-- views with a refresh on a schedule — but for current data volumes, live
-- views are fine.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- v_contact_outreach_summary
-- -----------------------------------------------------------------------------
-- One row per contact with aggregate outreach counts, first-touch, last-touch
-- across both channels. Powers "when did we last touch X" queries and the
-- stale-contact filter.
CREATE OR REPLACE VIEW public.v_contact_outreach_summary AS
WITH smartlead_agg AS (
  SELECT
    contact_id,
    COUNT(*) FILTER (WHERE direction = 'outbound') AS sl_outbound,
    COUNT(*) FILTER (WHERE direction = 'inbound')  AS sl_inbound,
    COUNT(*) FILTER (WHERE event_type = 'sent')    AS sl_sent,
    COUNT(*) FILTER (WHERE event_type = 'opened')  AS sl_opened,
    COUNT(*) FILTER (WHERE event_type = 'clicked') AS sl_clicked,
    COUNT(*) FILTER (WHERE event_type = 'replied') AS sl_replied,
    COUNT(*) FILTER (WHERE event_type = 'bounced') AS sl_bounced,
    MIN(sent_at) AS sl_first_touch_at,
    MAX(sent_at) AS sl_last_touch_at
  FROM smartlead_messages
  GROUP BY contact_id
),
heyreach_agg AS (
  SELECT
    contact_id,
    COUNT(*) FILTER (WHERE direction = 'outbound') AS hr_outbound,
    COUNT(*) FILTER (WHERE direction = 'inbound')  AS hr_inbound,
    COUNT(*) FILTER (WHERE event_type = 'connection_request_sent')     AS hr_connects_sent,
    COUNT(*) FILTER (WHERE event_type = 'connection_request_accepted') AS hr_connects_accepted,
    COUNT(*) FILTER (WHERE event_type = 'message_sent')                AS hr_messages_sent,
    COUNT(*) FILTER (WHERE event_type IN ('lead_replied','message_received','inmail_received')) AS hr_replies,
    MIN(sent_at) AS hr_first_touch_at,
    MAX(sent_at) AS hr_last_touch_at
  FROM heyreach_messages
  GROUP BY contact_id
)
SELECT
  c.id                                              AS contact_id,
  c.contact_type,
  c.first_name,
  c.last_name,
  c.email,
  c.linkedin_url,
  c.remarketing_buyer_id,
  c.listing_id,
  c.archived,

  -- SmartLead columns
  COALESCE(sl.sl_outbound, 0)  AS smartlead_outbound_events,
  COALESCE(sl.sl_inbound, 0)   AS smartlead_inbound_events,
  COALESCE(sl.sl_sent, 0)      AS smartlead_sent,
  COALESCE(sl.sl_opened, 0)    AS smartlead_opened,
  COALESCE(sl.sl_clicked, 0)   AS smartlead_clicked,
  COALESCE(sl.sl_replied, 0)   AS smartlead_replied,
  COALESCE(sl.sl_bounced, 0)   AS smartlead_bounced,
  sl.sl_first_touch_at         AS smartlead_first_touch_at,
  sl.sl_last_touch_at          AS smartlead_last_touch_at,

  -- HeyReach columns
  COALESCE(hr.hr_outbound, 0)       AS heyreach_outbound_events,
  COALESCE(hr.hr_inbound, 0)        AS heyreach_inbound_events,
  COALESCE(hr.hr_connects_sent, 0)     AS heyreach_connects_sent,
  COALESCE(hr.hr_connects_accepted, 0) AS heyreach_connects_accepted,
  COALESCE(hr.hr_messages_sent, 0)     AS heyreach_messages_sent,
  COALESCE(hr.hr_replies, 0)           AS heyreach_replies,
  hr.hr_first_touch_at          AS heyreach_first_touch_at,
  hr.hr_last_touch_at           AS heyreach_last_touch_at,

  -- Unified totals
  COALESCE(sl.sl_outbound, 0) + COALESCE(hr.hr_outbound, 0) AS total_outbound_events,
  COALESCE(sl.sl_inbound, 0)  + COALESCE(hr.hr_inbound, 0)  AS total_inbound_events,
  COALESCE(sl.sl_replied, 0)  + COALESCE(hr.hr_replies, 0)  AS total_replies,

  -- Unified first/last touch — oldest and newest across both channels
  LEAST(
    COALESCE(sl.sl_first_touch_at, 'infinity'::timestamptz),
    COALESCE(hr.hr_first_touch_at, 'infinity'::timestamptz)
  ) AS first_touch_at,
  GREATEST(
    COALESCE(sl.sl_last_touch_at, '-infinity'::timestamptz),
    COALESCE(hr.hr_last_touch_at, '-infinity'::timestamptz)
  ) AS last_touch_at

FROM public.contacts c
LEFT JOIN smartlead_agg sl ON sl.contact_id = c.id
LEFT JOIN heyreach_agg  hr ON hr.contact_id = c.id;

COMMENT ON VIEW public.v_contact_outreach_summary IS
  'One row per contact with aggregate SmartLead + HeyReach outreach counts '
  'and first/last touch timestamps. Use for stale-contact filters and '
  'per-contact engagement summaries.';


-- -----------------------------------------------------------------------------
-- v_firm_outreach_summary
-- -----------------------------------------------------------------------------
-- One row per remarketing_buyer (firm) with aggregate outreach across all
-- buyer contacts at that firm. Powers "show me everything we've done with
-- Summit Partners" queries.
CREATE OR REPLACE VIEW public.v_firm_outreach_summary AS
WITH smartlead_firm AS (
  SELECT
    remarketing_buyer_id,
    COUNT(DISTINCT contact_id) AS unique_contacts_touched,
    COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound_events,
    COUNT(*) FILTER (WHERE direction = 'inbound')  AS inbound_events,
    COUNT(*) FILTER (WHERE event_type = 'sent')    AS sent,
    COUNT(*) FILTER (WHERE event_type = 'opened')  AS opened,
    COUNT(*) FILTER (WHERE event_type = 'replied') AS replied,
    MAX(sent_at) AS last_touch_at
  FROM smartlead_messages
  WHERE remarketing_buyer_id IS NOT NULL
  GROUP BY remarketing_buyer_id
),
heyreach_firm AS (
  SELECT
    remarketing_buyer_id,
    COUNT(DISTINCT contact_id) AS unique_contacts_touched,
    COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound_events,
    COUNT(*) FILTER (WHERE direction = 'inbound')  AS inbound_events,
    COUNT(*) FILTER (WHERE event_type = 'connection_request_sent')     AS connects_sent,
    COUNT(*) FILTER (WHERE event_type = 'connection_request_accepted') AS connects_accepted,
    COUNT(*) FILTER (WHERE event_type = 'message_sent')                AS messages_sent,
    COUNT(*) FILTER (WHERE event_type IN ('lead_replied','message_received','inmail_received')) AS replies,
    MAX(sent_at) AS last_touch_at
  FROM heyreach_messages
  WHERE remarketing_buyer_id IS NOT NULL
  GROUP BY remarketing_buyer_id
)
SELECT
  rb.id                                   AS remarketing_buyer_id,
  rb.company_name                         AS firm_name,

  -- SmartLead rollup
  COALESCE(sl.unique_contacts_touched, 0) AS sl_contacts_touched,
  COALESCE(sl.outbound_events, 0)         AS sl_outbound_events,
  COALESCE(sl.inbound_events, 0)          AS sl_inbound_events,
  COALESCE(sl.sent, 0)                    AS sl_sent,
  COALESCE(sl.opened, 0)                  AS sl_opened,
  COALESCE(sl.replied, 0)                 AS sl_replied,
  sl.last_touch_at                        AS sl_last_touch_at,

  -- HeyReach rollup
  COALESCE(hr.unique_contacts_touched, 0) AS hr_contacts_touched,
  COALESCE(hr.outbound_events, 0)         AS hr_outbound_events,
  COALESCE(hr.inbound_events, 0)          AS hr_inbound_events,
  COALESCE(hr.connects_sent, 0)           AS hr_connects_sent,
  COALESCE(hr.connects_accepted, 0)       AS hr_connects_accepted,
  COALESCE(hr.messages_sent, 0)           AS hr_messages_sent,
  COALESCE(hr.replies, 0)                 AS hr_replies,
  hr.last_touch_at                        AS hr_last_touch_at,

  -- Unified
  GREATEST(
    COALESCE(sl.last_touch_at, '-infinity'::timestamptz),
    COALESCE(hr.last_touch_at, '-infinity'::timestamptz)
  ) AS last_touch_at,
  COALESCE(sl.replied, 0) + COALESCE(hr.replies, 0) AS total_replies,
  COALESCE(sl.outbound_events, 0) + COALESCE(hr.outbound_events, 0) AS total_outbound_events

FROM public.remarketing_buyers rb
LEFT JOIN smartlead_firm sl ON sl.remarketing_buyer_id = rb.id
LEFT JOIN heyreach_firm  hr ON hr.remarketing_buyer_id = rb.id
WHERE sl.remarketing_buyer_id IS NOT NULL OR hr.remarketing_buyer_id IS NOT NULL;

COMMENT ON VIEW public.v_firm_outreach_summary IS
  'Aggregate outreach rollup at the firm level (remarketing_buyers). '
  'Excludes firms with zero outreach activity.';


-- -----------------------------------------------------------------------------
-- v_campaign_outreach_stats
-- -----------------------------------------------------------------------------
-- Per-campaign performance metrics. Powers reply-rate / accept-rate leaderboards.
CREATE OR REPLACE VIEW public.v_campaign_outreach_stats AS
SELECT
  'smartlead'::TEXT                               AS channel,
  sm.smartlead_campaign_id                        AS external_campaign_id,
  sc.name                                         AS campaign_name,
  sc.status                                       AS campaign_status,
  COUNT(DISTINCT sm.contact_id)                   AS unique_contacts,
  COUNT(*) FILTER (WHERE sm.event_type = 'sent')       AS sent,
  COUNT(*) FILTER (WHERE sm.event_type = 'opened')     AS opened,
  COUNT(*) FILTER (WHERE sm.event_type = 'clicked')    AS clicked,
  COUNT(*) FILTER (WHERE sm.event_type = 'replied')    AS replied,
  COUNT(*) FILTER (WHERE sm.event_type = 'bounced')    AS bounced,
  COUNT(*) FILTER (WHERE sm.event_type = 'unsubscribed') AS unsubscribed,
  ROUND(
    100.0 * NULLIF(COUNT(DISTINCT sm.contact_id) FILTER (WHERE sm.event_type = 'replied'), 0)
         / NULLIF(COUNT(DISTINCT sm.contact_id) FILTER (WHERE sm.event_type = 'sent'), 0),
    2
  ) AS reply_rate_pct,
  MIN(sm.sent_at)                                 AS first_activity_at,
  MAX(sm.sent_at)                                 AS last_activity_at
FROM smartlead_messages sm
LEFT JOIN smartlead_campaigns sc ON sc.smartlead_campaign_id = sm.smartlead_campaign_id
GROUP BY sm.smartlead_campaign_id, sc.name, sc.status

UNION ALL

SELECT
  'heyreach'::TEXT                                AS channel,
  hm.heyreach_campaign_id                         AS external_campaign_id,
  hc.name                                         AS campaign_name,
  hc.status                                       AS campaign_status,
  COUNT(DISTINCT hm.contact_id)                   AS unique_contacts,
  COUNT(*) FILTER (WHERE hm.event_type = 'connection_request_sent')     AS sent,
  NULL::BIGINT                                    AS opened,
  NULL::BIGINT                                    AS clicked,
  COUNT(*) FILTER (WHERE hm.event_type IN ('lead_replied','message_received','inmail_received')) AS replied,
  NULL::BIGINT                                    AS bounced,
  NULL::BIGINT                                    AS unsubscribed,
  ROUND(
    100.0 * NULLIF(COUNT(*) FILTER (WHERE hm.event_type = 'connection_request_accepted'), 0)
         / NULLIF(COUNT(*) FILTER (WHERE hm.event_type = 'connection_request_sent'), 0),
    2
  ) AS reply_rate_pct,  -- reused as accept_rate_pct for HeyReach rows
  MIN(hm.sent_at)                                 AS first_activity_at,
  MAX(hm.sent_at)                                 AS last_activity_at
FROM heyreach_messages hm
LEFT JOIN heyreach_campaigns hc ON hc.heyreach_campaign_id = hm.heyreach_campaign_id
GROUP BY hm.heyreach_campaign_id, hc.name, hc.status;

COMMENT ON VIEW public.v_campaign_outreach_stats IS
  'Per-campaign performance leaderboard across both channels. For HeyReach '
  'rows, reply_rate_pct is actually connect-acceptance rate (no real email '
  'open/click semantics on LinkedIn).';


-- -----------------------------------------------------------------------------
-- Grants — views inherit RLS from their base tables but grants are still
-- needed for authenticated role visibility
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.v_contact_outreach_summary TO authenticated, service_role;
GRANT SELECT ON public.v_firm_outreach_summary    TO authenticated, service_role;
GRANT SELECT ON public.v_campaign_outreach_stats  TO authenticated, service_role;
