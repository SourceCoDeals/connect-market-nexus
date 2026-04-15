-- Remarketing Dashboard V2 — Phase 1
--
-- Extends get_remarketing_dashboard_stats with:
--   • Hero strip metrics: pipeline EBITDA, diligence+ count/value, closed won count/value
--   • outreach_stats: SmartLead emails, HeyReach LinkedIn, PhoneBurner calls aggregated in-period
--   • ebitda_by_source: $ contribution per deal source (not just deal count)
--   • industry_breakdown: top 10 categories by deal count
--   • weekly: extended from 8 weeks to 12 weeks
--   • top_deals: extended from 8 to 10
--
-- Signature is unchanged so all existing callers remain valid; they simply see
-- new keys in the returned jsonb that they can ignore.
--
-- NOTE: fee_earned / commission_rate columns do not exist on deal_pipeline, so
-- total_fees_earned is not yet emitted. If / when those columns are added, this
-- RPC should be extended to sum them for Closed Won deals in period.

CREATE OR REPLACE FUNCTION public.get_remarketing_dashboard_stats(p_from_date timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH base AS (
    SELECT
      id, title, internal_company_name, deal_source, pushed_to_all_deals,
      pushed_to_all_deals_at, deal_total_score, deal_owner_id,
      enrichment_status, enriched_at, created_at, revenue, ebitda,
      category, address_state, status, remarketing_status
    FROM listings
    WHERE remarketing_status = 'active'
  ),
  visible AS (
    SELECT * FROM base
    WHERE status NOT IN ('archived', 'inactive')
      AND NOT (
        deal_source IN ('captarget', 'gp_partners', 'sourceco', 'valuation_calculator')
        AND (pushed_to_all_deals IS NULL OR pushed_to_all_deals = false)
      )
  ),
  -- Header card counts (existing + new hero strip fields)
  cards AS (
    SELECT
      (SELECT count(*) FROM visible) AS all_visible,
      -- Pipeline $EBITDA across all visible active deals. Null-safe: ebitda
      -- may be null so COALESCE to 0 in SUM and cast to bigint (cents-safe).
      (SELECT coalesce(sum(ebitda), 0)::bigint FROM visible) AS total_pipeline_ebitda,
      (SELECT count(*) FROM visible WHERE
        CASE
          WHEN p_from_date IS NULL THEN true
          WHEN deal_source IN ('captarget', 'gp_partners', 'sourceco') THEN pushed_to_all_deals_at IS NOT NULL AND pushed_to_all_deals_at >= p_from_date
          ELSE created_at >= p_from_date
        END
      ) AS all_new_in_period,
      (SELECT count(*) FROM base WHERE deal_source = 'captarget') AS ct_total,
      (SELECT count(*) FROM base WHERE deal_source = 'captarget' AND (p_from_date IS NULL OR created_at >= p_from_date)) AS ct_new,
      (SELECT count(*) FROM base WHERE deal_source = 'captarget' AND pushed_to_all_deals = true) AS ct_pushed,
      (SELECT coalesce(round(avg(deal_total_score)), 0) FROM base WHERE deal_source = 'captarget' AND deal_total_score IS NOT NULL) AS ct_avg,
      (SELECT count(*) FROM base WHERE deal_source = 'captarget' AND pushed_to_all_deals = true
        AND (p_from_date IS NULL OR (pushed_to_all_deals_at IS NOT NULL AND pushed_to_all_deals_at >= p_from_date))) AS ct_approved_in_period,
      (SELECT count(*) FROM base WHERE deal_source = 'gp_partners') AS gp_total,
      (SELECT count(*) FROM base WHERE deal_source = 'gp_partners' AND (p_from_date IS NULL OR created_at >= p_from_date)) AS gp_new,
      (SELECT count(*) FROM base WHERE deal_source = 'gp_partners' AND pushed_to_all_deals = true) AS gp_pushed,
      (SELECT coalesce(round(avg(deal_total_score)), 0) FROM base WHERE deal_source = 'gp_partners' AND deal_total_score IS NOT NULL) AS gp_avg,
      (SELECT count(*) FROM base WHERE deal_source = 'gp_partners' AND pushed_to_all_deals = true
        AND (p_from_date IS NULL OR (pushed_to_all_deals_at IS NOT NULL AND pushed_to_all_deals_at >= p_from_date))) AS gp_approved_in_period,
      (SELECT count(*) FROM base WHERE deal_source = 'sourceco') AS sc_total,
      (SELECT count(*) FROM base WHERE deal_source = 'sourceco' AND (p_from_date IS NULL OR created_at >= p_from_date)) AS sc_new,
      (SELECT count(*) FROM base WHERE deal_source = 'sourceco' AND pushed_to_all_deals = true) AS sc_pushed,
      (SELECT coalesce(round(avg(deal_total_score)), 0) FROM base WHERE deal_source = 'sourceco' AND deal_total_score IS NOT NULL) AS sc_avg,
      (SELECT count(*) FROM base WHERE deal_source = 'sourceco' AND pushed_to_all_deals = true
        AND (p_from_date IS NULL OR (pushed_to_all_deals_at IS NOT NULL AND pushed_to_all_deals_at >= p_from_date))) AS sc_approved_in_period,
      (SELECT count(*) FROM base WHERE deal_source NOT IN ('captarget', 'gp_partners', 'sourceco') OR deal_source IS NULL) AS other_total,
      (SELECT count(*) FROM base WHERE deal_source = 'marketplace') AS marketplace_total,
      (SELECT count(*) FROM base WHERE deal_source IS NULL OR deal_source = 'manual') AS manual_total,
      (SELECT count(*) FROM base WHERE enrichment_status = 'enriched' OR (enriched_at IS NOT NULL AND enrichment_status IS NULL)) AS enriched,
      (SELECT count(*) FROM base WHERE enrichment_status = 'pending') AS pending_enrichment,
      (SELECT count(*) FROM base WHERE enrichment_status = 'failed') AS failed_enrichment,
      (SELECT count(*) FROM base WHERE deal_total_score IS NOT NULL) AS total_scored,
      -- Deals in Due Diligence or LOI — the "most likely to close" bucket.
      -- Filtering by stage NAME (not position) because position numbering has
      -- changed historically and production uses position 4 for Due Diligence,
      -- not 7. Add new "in-play" stage names here as the pipeline evolves.
      (SELECT count(*)
        FROM deal_pipeline dp
        JOIN deal_stages ds ON ds.id = dp.stage_id
       WHERE dp.deleted_at IS NULL
         AND ds.name IN ('Due Diligence', 'LOI Submitted', 'Under Contract')
      ) AS deals_in_diligence_plus,
      (SELECT coalesce(sum(l.ebitda), 0)::bigint
        FROM deal_pipeline dp
        JOIN deal_stages ds ON ds.id = dp.stage_id
        JOIN listings l ON l.id = dp.listing_id
       WHERE dp.deleted_at IS NULL
         AND ds.name IN ('Due Diligence', 'LOI Submitted', 'Under Contract')
      ) AS ebitda_in_diligence_plus,
      -- Closed Won in period. "In period" uses deal_pipeline.updated_at because
      -- closed_at isn't consistently set; stage moves update updated_at via
      -- the stage-log trigger.
      (SELECT count(*)
        FROM deal_pipeline dp
        JOIN deal_stages ds ON ds.id = dp.stage_id
       WHERE dp.deleted_at IS NULL
         AND ds.name = 'Closed Won'
         AND (p_from_date IS NULL OR dp.updated_at >= p_from_date)
      ) AS closed_won_count,
      (SELECT coalesce(sum(l.ebitda), 0)::bigint
        FROM deal_pipeline dp
        JOIN deal_stages ds ON ds.id = dp.stage_id
        JOIN listings l ON l.id = dp.listing_id
       WHERE dp.deleted_at IS NULL
         AND ds.name = 'Closed Won'
         AND (p_from_date IS NULL OR dp.updated_at >= p_from_date)
      ) AS closed_won_ebitda
  ),
  -- Source counts for "new in period"
  new_by_source AS (
    SELECT coalesce(deal_source, 'manual') AS src, count(*) AS cnt
    FROM base
    WHERE p_from_date IS NULL OR created_at >= p_from_date
    GROUP BY coalesce(deal_source, 'manual')
  ),
  -- All source counts (visible)
  all_by_source AS (
    SELECT coalesce(deal_source, 'manual') AS src, count(*) AS cnt
    FROM visible
    GROUP BY coalesce(deal_source, 'manual')
  ),
  -- EBITDA contribution per source (shows which sources bring value, not just volume)
  ebitda_by_src AS (
    SELECT coalesce(deal_source, 'manual') AS src,
           coalesce(sum(ebitda), 0)::bigint AS total_ebitda
    FROM visible
    WHERE ebitda IS NOT NULL
    GROUP BY coalesce(deal_source, 'manual')
  ),
  -- Top 10 industries by deal count (from visible listings)
  industries AS (
    SELECT jsonb_agg(row_to_json(i)::jsonb ORDER BY cnt DESC) AS rows
    FROM (
      SELECT coalesce(category, 'Uncategorized') AS category, count(*) AS cnt
      FROM visible
      GROUP BY coalesce(category, 'Uncategorized')
      ORDER BY count(*) DESC
      LIMIT 10
    ) i
  ),
  -- Team assignments
  team AS (
    SELECT coalesce(deal_owner_id::text, '__unassigned') AS owner_id,
      count(*) AS total,
      count(*) FILTER (WHERE enrichment_status = 'enriched' OR enriched_at IS NOT NULL) AS enriched,
      count(*) FILTER (WHERE deal_total_score IS NOT NULL) AS scored
    FROM visible
    GROUP BY coalesce(deal_owner_id::text, '__unassigned')
  ),
  -- Score distribution
  score_dist AS (
    SELECT
      count(*) FILTER (WHERE deal_total_score >= 80) AS tier_80_100,
      count(*) FILTER (WHERE deal_total_score >= 60 AND deal_total_score < 80) AS tier_60_79,
      count(*) FILTER (WHERE deal_total_score >= 40 AND deal_total_score < 60) AS tier_40_59,
      count(*) FILTER (WHERE deal_total_score >= 20 AND deal_total_score < 40) AS tier_20_39,
      count(*) FILTER (WHERE deal_total_score < 20 OR deal_total_score IS NULL) AS tier_0_19
    FROM base
  ),
  -- Top 10 deals by score in period (was 8)
  top AS (
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY deal_total_score DESC NULLS LAST) AS deals
    FROM (
      SELECT id, title, internal_company_name, deal_source, deal_total_score,
             category, revenue, ebitda, address_state, created_at
      FROM base
      WHERE deal_total_score IS NOT NULL
        AND (p_from_date IS NULL OR created_at >= p_from_date)
      ORDER BY deal_total_score DESC
      LIMIT 10
    ) t
  ),
  -- Weekly chart — extended from 8 weeks to 12 (84 days)
  weekly AS (
    SELECT
      date_trunc('week', added_date)::date AS week_start,
      count(*) AS cnt
    FROM (
      SELECT
        CASE
          WHEN deal_source IN ('captarget', 'gp_partners', 'sourceco') AND pushed_to_all_deals = true AND pushed_to_all_deals_at IS NOT NULL
            THEN pushed_to_all_deals_at
          ELSE created_at
        END AS added_date
      FROM base
    ) sub
    WHERE added_date >= (now() - interval '84 days')
    GROUP BY date_trunc('week', added_date)::date
  ),
  -- Recent activity (5 most recent events)
  recent AS (
    SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY date DESC) AS events
    FROM (
      SELECT created_at AS date, 'created' AS type, coalesce(internal_company_name, title, 'Unknown') AS name, deal_source AS source
      FROM base
      UNION ALL
      SELECT pushed_to_all_deals_at AS date, 'pushed' AS type, coalesce(internal_company_name, title, 'Unknown') AS name, deal_source AS source
      FROM base WHERE pushed_to_all_deals = true AND pushed_to_all_deals_at IS NOT NULL
      ORDER BY date DESC
      LIMIT 5
    ) r
  ),
  -- Outreach counts in period (email / LinkedIn / call). Falls back to
  -- all-time when p_from_date is null so the hero strip always shows a value.
  -- event_type values in smartlead_messages/heyreach_messages are lowercase.
  outreach AS (
    SELECT
      (SELECT count(*) FROM smartlead_messages
        WHERE direction = 'outbound'
          AND event_type = 'sent'
          AND (p_from_date IS NULL OR sent_at >= p_from_date)
      ) AS emails_sent,
      (SELECT count(*) FROM smartlead_messages
        WHERE direction = 'outbound'
          AND event_type = 'opened'
          AND (p_from_date IS NULL OR sent_at >= p_from_date)
      ) AS emails_opened,
      -- Reply events — direction filter omitted because 'replied' events come
      -- in as inbound on the webhook but the table schema allows either.
      (SELECT count(*) FROM smartlead_messages
        WHERE event_type = 'replied'
          AND (p_from_date IS NULL OR sent_at >= p_from_date)
      ) AS emails_replied,
      (SELECT count(*) FROM heyreach_messages
        WHERE direction = 'outbound'
          AND event_type IN ('connection_request_sent','message_sent','inmail_sent')
          AND (p_from_date IS NULL OR sent_at >= p_from_date)
      ) AS linkedin_sent,
      (SELECT count(*) FROM heyreach_messages
        WHERE direction = 'inbound'
          AND event_type IN ('message_received','inmail_received','lead_replied','lead_interested')
          AND (p_from_date IS NULL OR sent_at >= p_from_date)
      ) AS linkedin_replied,
      -- Match the existing useDashboardData call counting: any row with a
      -- call_started_at is a call attempt. activity_type is not CHECK-constrained
      -- so we can't rely on it without risking false negatives.
      (SELECT count(*) FROM contact_activities ca
        WHERE ca.call_started_at IS NOT NULL
          AND (p_from_date IS NULL OR ca.created_at >= p_from_date)
      ) AS calls_made,
      (SELECT count(*) FROM contact_activities ca
        WHERE ca.call_started_at IS NOT NULL
          AND ca.call_connected = true
          AND (p_from_date IS NULL OR ca.created_at >= p_from_date)
      ) AS calls_connected
  )
  SELECT jsonb_build_object(
    'cards', (SELECT row_to_json(cards)::jsonb FROM cards),
    'new_by_source', (SELECT coalesce(jsonb_object_agg(src, cnt), '{}'::jsonb) FROM new_by_source),
    'all_by_source', (SELECT coalesce(jsonb_object_agg(src, cnt), '{}'::jsonb) FROM all_by_source),
    'ebitda_by_source', (SELECT coalesce(jsonb_object_agg(src, total_ebitda), '{}'::jsonb) FROM ebitda_by_src),
    'industry_breakdown', (SELECT coalesce(rows, '[]'::jsonb) FROM industries),
    'team', (SELECT coalesce(jsonb_agg(row_to_json(team)::jsonb), '[]'::jsonb) FROM team),
    'score_dist', (SELECT row_to_json(score_dist)::jsonb FROM score_dist),
    'top_deals', (SELECT coalesce(deals, '[]'::jsonb) FROM top),
    'weekly', (SELECT coalesce(jsonb_object_agg(week_start::text, cnt), '{}'::jsonb) FROM weekly),
    'recent_activity', (SELECT coalesce(events, '[]'::jsonb) FROM recent),
    'outreach_stats', (SELECT row_to_json(outreach)::jsonb FROM outreach)
  ) INTO result;

  RETURN result;
END;
$$;
