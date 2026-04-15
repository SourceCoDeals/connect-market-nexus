-- ============================================================================
-- CapTarget leads page — server-side stats + filter options
--
-- Background
-- ----------
-- The CapTarget leads page previously fetched every captarget listing row into
-- the browser just to compute counters, KPI cards, tab badges, and dynamic
-- filter-dropdown options. Commit ae8392d (Apr 8) replaced that fetch with a
-- single unpaginated "stats" query, which PostgREST silently caps at
-- `max_rows = 1000` (supabase/config.toml). Consequently every counter on the
-- page maxes out at 1,000 even when the underlying table holds ~7,000 rows.
--
-- These two RPCs push all of that work down to Postgres:
--
--   • get_captarget_page_stats — returns a single JSON blob containing the
--     summary header counts, KPI card values, and status-tab totals.
--     Accepts the same base filters the UI applies (date range, hide-pushed,
--     hide-not-fit) so KPI/tab figures update as toggles change.
--
--   • get_captarget_filter_options — returns DISTINCT values per dynamic
--     filter field (source tab, outreach channel, industry, employee range).
--     Cached long on the client; only changes when the underlying data does.
--
-- Both are SECURITY DEFINER + admin-gated, matching get_remarketing_dashboard_stats.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- get_captarget_page_stats
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_captarget_page_stats(
  p_date_from    timestamptz DEFAULT NULL,
  p_date_to      timestamptz DEFAULT NULL,
  p_hide_pushed  boolean     DEFAULT false,
  p_hide_not_fit boolean     DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  WITH base AS (
    SELECT
      id,
      pushed_to_all_deals,
      captarget_interest_type,
      enriched_at,
      deal_total_score,
      is_priority_target,
      captarget_status,
      captarget_contact_date,
      created_at,
      remarketing_status
    FROM listings
    WHERE deal_source = 'captarget'
  ),
  -- Summary counts: completely unfiltered (matches the header line
  -- "{N} total · {unpushed} un-pushed · {interest} interest · …")
  summary AS (
    SELECT
      count(*)                                                            AS total_deals,
      count(*) FILTER (WHERE pushed_to_all_deals IS NOT TRUE)              AS unpushed_count,
      count(*) FILTER (WHERE captarget_interest_type = 'interest')         AS interest_count,
      count(*) FILTER (WHERE enriched_at IS NOT NULL)                      AS enriched_count,
      count(*) FILTER (WHERE deal_total_score IS NOT NULL)                 AS scored_count
    FROM base
  ),
  -- KPI cards: filtered by the active timeframe only. Mirrors the client-side
  -- `isInRange(captarget_contact_date || created_at)` semantics.
  kpi_base AS (
    SELECT *
    FROM base
    WHERE (p_date_from IS NULL OR COALESCE(captarget_contact_date, created_at) >= p_date_from)
      AND (p_date_to   IS NULL OR COALESCE(captarget_contact_date, created_at) <= p_date_to)
  ),
  kpi AS (
    SELECT
      count(*)                                                 AS total_deals,
      count(*) FILTER (WHERE is_priority_target = true)         AS priority_deals,
      COALESCE(round(avg(deal_total_score)
        FILTER (WHERE deal_total_score IS NOT NULL)), 0)        AS avg_score,
      count(*) FILTER (WHERE deal_total_score IS NULL)          AS needs_scoring
    FROM kpi_base
  ),
  -- Status tab counts: base filters (hide-pushed, hide-not-fit, timeframe)
  -- applied but NOT the captarget_status tab itself — so active + inactive
  -- always sum to "all".
  tab_base AS (
    SELECT *
    FROM base
    WHERE (NOT p_hide_pushed OR pushed_to_all_deals IS NOT TRUE)
      AND (NOT p_hide_not_fit
           OR remarketing_status IS NULL
           OR remarketing_status <> 'not_a_fit')
      AND (p_date_from IS NULL OR COALESCE(captarget_contact_date, created_at) >= p_date_from)
      AND (p_date_to   IS NULL OR COALESCE(captarget_contact_date, created_at) <= p_date_to)
  ),
  tabs AS (
    SELECT
      count(*)                                              AS filtered_total,
      count(*) FILTER (WHERE captarget_status = 'active')    AS active_count,
      count(*) FILTER (WHERE captarget_status = 'inactive')  AS inactive_count
    FROM tab_base
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'total_deals',    summary.total_deals,
      'unpushed_count', summary.unpushed_count,
      'interest_count', summary.interest_count,
      'enriched_count', summary.enriched_count,
      'scored_count',   summary.scored_count
    ),
    'kpi', jsonb_build_object(
      'total_deals',    kpi.total_deals,
      'priority_deals', kpi.priority_deals,
      'avg_score',      kpi.avg_score,
      'needs_scoring',  kpi.needs_scoring
    ),
    'tabs', jsonb_build_object(
      'filtered_total', tabs.filtered_total,
      'active_count',   tabs.active_count,
      'inactive_count', tabs.inactive_count
    )
  )
  INTO result
  FROM summary, kpi, tabs;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_captarget_page_stats(timestamptz, timestamptz, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_captarget_page_stats(timestamptz, timestamptz, boolean, boolean) TO authenticated;

COMMENT ON FUNCTION public.get_captarget_page_stats(timestamptz, timestamptz, boolean, boolean) IS
'Aggregate counters for the CapTarget leads admin page. Returns summary (unfiltered header counts), kpi (timeframe-filtered), and tabs (base-filtered). Admin-gated.';


-- ────────────────────────────────────────────────────────────────────────────
-- get_captarget_filter_options
-- ────────────────────────────────────────────────────────────────────────────
--
-- One query per dynamic-options filter field. Distinct values for the full
-- captarget dataset, not whatever happened to be in the first 1,000 rows.
-- Returns a JSON map of field_key -> array of {label, value}.

CREATE OR REPLACE FUNCTION public.get_captarget_filter_options()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  WITH sheet_tabs AS (
    SELECT DISTINCT captarget_sheet_tab AS v
    FROM listings
    WHERE deal_source = 'captarget'
      AND captarget_sheet_tab IS NOT NULL
      AND captarget_sheet_tab <> ''
    ORDER BY v
  ),
  outreach_channels AS (
    SELECT DISTINCT captarget_outreach_channel AS v
    FROM listings
    WHERE deal_source = 'captarget'
      AND captarget_outreach_channel IS NOT NULL
      AND captarget_outreach_channel <> ''
    ORDER BY v
  ),
  -- The UI accessor for the 'category' filter prefers `industry` then
  -- `category`; mirror that here so the dropdown options match what the
  -- rows actually render.
  industries AS (
    SELECT DISTINCT COALESCE(NULLIF(industry, ''), NULLIF(category, '')) AS v
    FROM listings
    WHERE deal_source = 'captarget'
      AND COALESCE(NULLIF(industry, ''), NULLIF(category, '')) IS NOT NULL
    ORDER BY v
  ),
  employee_ranges AS (
    SELECT DISTINCT linkedin_employee_range AS v
    FROM listings
    WHERE deal_source = 'captarget'
      AND linkedin_employee_range IS NOT NULL
      AND linkedin_employee_range <> ''
    ORDER BY v
  )
  SELECT jsonb_build_object(
    'captarget_sheet_tab',
      COALESCE((SELECT jsonb_agg(jsonb_build_object('label', v, 'value', v)) FROM sheet_tabs), '[]'::jsonb),
    'captarget_outreach_channel',
      COALESCE((SELECT jsonb_agg(jsonb_build_object('label', v, 'value', v)) FROM outreach_channels), '[]'::jsonb),
    'category',
      COALESCE((SELECT jsonb_agg(jsonb_build_object('label', v, 'value', v)) FROM industries), '[]'::jsonb),
    'linkedin_employee_range',
      COALESCE((SELECT jsonb_agg(jsonb_build_object('label', v, 'value', v)) FROM employee_ranges), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_captarget_filter_options() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_captarget_filter_options() TO authenticated;

COMMENT ON FUNCTION public.get_captarget_filter_options() IS
'DISTINCT filter dropdown values for the CapTarget leads page. Uses COALESCE(industry, category) for the "category" field to match the UI accessor. Admin-gated.';
