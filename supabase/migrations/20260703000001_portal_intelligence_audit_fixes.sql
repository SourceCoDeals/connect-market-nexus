-- Portal Intelligence — Audit Remediation
-- Fixes issues identified in the post-merge audit of 20260703000000_portal_intelligence.sql:
--   P0-2:  Register cron job so process-portal-recommendations actually runs
--   P0-6:  Replace profiles.is_admin RLS checks with public.is_admin(auth.uid())
--   P1-8:  Pin SET search_path on SECURITY DEFINER trigger function
--   P1-9:  Enable RLS on portal_recommendation_queue
--   P1-10: Add ON DELETE CASCADE FK on portal_deal_recommendations.listing_id
--          and portal_intelligence_docs.listing_id so deleted listings don't
--          leave stranded rows
--   P1-13: Require non-empty industry_keywords on portal_thesis_criteria
--   P2-18: Skip deleted / not_a_fit listings in the queue trigger
--   P2-19: Replace no-op `WHEN (OLD IS DISTINCT FROM NEW)` with per-column check
--   P2-20: Widen money columns from INTEGER to BIGINT (>$2.1B cap)
--   P3-22: CHECK constraints enforcing min <= max on size ranges
--
-- Product decision: thesis criteria and deal recommendations are
-- INTERNAL-ONLY — portal users (clients) should NOT be able to see either.
-- This migration also revokes the pre-existing "Portal users can view own
-- org criteria" SELECT policy from the 20260703000000 migration.

-- All statements are idempotent (safe to re-run).

-- ================================================================
-- P0-6: RLS policies — use is_admin() (was profiles.is_admin, which is a
-- stale-cache regression fixed everywhere else in the codebase).
-- Thesis criteria + recommendations are admin-only — portal users must
-- NOT see either. Intelligence docs are also admin-only (no change).
-- ================================================================
DROP POLICY IF EXISTS "Admins can manage thesis criteria" ON portal_thesis_criteria;
CREATE POLICY "Admins can manage thesis criteria"
  ON portal_thesis_criteria FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Revoke the client-visible SELECT policy that shipped in 20260703000000.
-- Portal users (clients) should not see their own thesis criteria — this
-- data is SourceCo's internal targeting, not for client consumption.
DROP POLICY IF EXISTS "Portal users can view own org criteria" ON portal_thesis_criteria;

DROP POLICY IF EXISTS "Admins can manage intelligence docs" ON portal_intelligence_docs;
CREATE POLICY "Admins can manage intelligence docs"
  ON portal_intelligence_docs FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage recommendations" ON portal_deal_recommendations;
CREATE POLICY "Admins can manage recommendations"
  ON portal_deal_recommendations FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Intentionally no SELECT policy for portal users on portal_deal_recommendations.
-- Recommendations are internal-only. With RLS enabled and no matching
-- policy, portal-user queries return zero rows (not an error).

-- ================================================================
-- P1-9: Enable RLS on portal_recommendation_queue (service role still bypasses)
-- ================================================================
ALTER TABLE portal_recommendation_queue ENABLE ROW LEVEL SECURITY;

-- No policies = deny all to authenticated/anon; service role bypasses RLS.

-- ================================================================
-- P1-10: Add FK constraints for listing references
-- ================================================================
DO $$ BEGIN
  ALTER TABLE portal_deal_recommendations
    ADD CONSTRAINT portal_deal_recommendations_listing_id_fkey
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE portal_intelligence_docs
    ADD CONSTRAINT portal_intelligence_docs_listing_id_fkey
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE portal_recommendation_queue
    ADD CONSTRAINT portal_recommendation_queue_listing_id_fkey
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ================================================================
-- P1-13 / P3-22: CHECK constraints on portal_thesis_criteria
-- ================================================================
DO $$ BEGIN
  ALTER TABLE portal_thesis_criteria
    ADD CONSTRAINT portal_thesis_criteria_keywords_non_empty
    CHECK (cardinality(industry_keywords) > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE portal_thesis_criteria
    ADD CONSTRAINT portal_thesis_criteria_ebitda_range_valid
    CHECK (ebitda_min IS NULL OR ebitda_max IS NULL OR ebitda_min <= ebitda_max);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE portal_thesis_criteria
    ADD CONSTRAINT portal_thesis_criteria_revenue_range_valid
    CHECK (revenue_min IS NULL OR revenue_max IS NULL OR revenue_min <= revenue_max);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE portal_thesis_criteria
    ADD CONSTRAINT portal_thesis_criteria_employee_range_valid
    CHECK (employee_min IS NULL OR employee_max IS NULL OR employee_min <= employee_max);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ================================================================
-- P2-20: Widen INTEGER money columns to BIGINT
-- ================================================================
ALTER TABLE portal_thesis_criteria
  ALTER COLUMN ebitda_min  TYPE BIGINT,
  ALTER COLUMN ebitda_max  TYPE BIGINT,
  ALTER COLUMN revenue_min TYPE BIGINT,
  ALTER COLUMN revenue_max TYPE BIGINT;

-- ================================================================
-- P0-5: Add 'stale' status so the edge function can reap recs for
-- deals that no longer match any thesis (instead of leaving them
-- in 'pending' forever).
-- ================================================================
ALTER TABLE portal_deal_recommendations
  DROP CONSTRAINT IF EXISTS portal_deal_recommendations_status_check;

ALTER TABLE portal_deal_recommendations
  ADD CONSTRAINT portal_deal_recommendations_status_check
  CHECK (status IN ('pending', 'approved', 'pushed', 'dismissed', 'stale'));

-- ================================================================
-- P1-8 + P2-18: SECURITY DEFINER function with pinned search_path
-- + skip dead listings (deleted_at / not_a_fit) at enqueue time
-- ================================================================
CREATE OR REPLACE FUNCTION public.queue_portal_recommendation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Skip soft-deleted or explicitly-not-a-fit listings
  IF NEW.deleted_at IS NOT NULL OR NEW.not_a_fit IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Only queue if at least one active thesis criterion exists on an active portal
  IF EXISTS (
    SELECT 1 FROM public.portal_thesis_criteria ptc
    JOIN public.portal_organizations po ON ptc.portal_org_id = po.id
    WHERE ptc.is_active = TRUE AND po.status = 'active'
    LIMIT 1
  ) THEN
    INSERT INTO public.portal_recommendation_queue (listing_id, queued_at)
    VALUES (NEW.id, now())
    ON CONFLICT (listing_id) DO UPDATE SET queued_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- ================================================================
-- P2-19: Replace the no-op `WHEN (OLD IS DISTINCT FROM NEW)` on the
-- update trigger with a per-column DISTINCT check. Postgres does not
-- support altering a trigger WHEN clause — we drop and recreate.
-- ================================================================
DROP TRIGGER IF EXISTS trg_portal_reco_deal_update ON listings;

CREATE TRIGGER trg_portal_reco_deal_update
  AFTER UPDATE OF industry, category, address_state, ebitda, revenue,
    linkedin_employee_count, services, categories, executive_summary,
    deal_total_score, enriched_at
  ON listings
  FOR EACH ROW
  WHEN (
    OLD.industry                IS DISTINCT FROM NEW.industry
    OR OLD.category             IS DISTINCT FROM NEW.category
    OR OLD.address_state        IS DISTINCT FROM NEW.address_state
    OR OLD.ebitda               IS DISTINCT FROM NEW.ebitda
    OR OLD.revenue              IS DISTINCT FROM NEW.revenue
    OR OLD.linkedin_employee_count IS DISTINCT FROM NEW.linkedin_employee_count
    OR OLD.services             IS DISTINCT FROM NEW.services
    OR OLD.categories           IS DISTINCT FROM NEW.categories
    OR OLD.executive_summary    IS DISTINCT FROM NEW.executive_summary
    OR OLD.deal_total_score     IS DISTINCT FROM NEW.deal_total_score
    OR OLD.enriched_at          IS DISTINCT FROM NEW.enriched_at
  )
  EXECUTE FUNCTION public.queue_portal_recommendation();

-- ================================================================
-- P0-2: Register pg_cron job to drain the recommendation queue every 5 min
-- Idempotent: unschedule first (ignoring errors), then schedule.
-- Gated on pg_cron extension being installed.
-- ================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('process-portal-recommendations');
    EXCEPTION WHEN others THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'process-portal-recommendations',
      '*/5 * * * *',
      $sql$
      SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/process-portal-recommendations',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      ) AS request_id;
      $sql$
    );
  END IF;
END $$;
