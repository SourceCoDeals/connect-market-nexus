-- ═══════════════════════════════════════════════════════════════
-- Migration: enrichment_test_tracking
-- Date: 2026-03-26
-- Purpose: Creates tables and views for tracking contact enrichment test runs,
--          recording per-contact results, and monitoring success rates over time.
-- Tables affected: enrichment_test_runs, enrichment_test_results
-- ═══════════════════════════════════════════════════════════════

-- Enrichment Test Tracking
-- Tracks success rate of contact enrichment over time.
-- Each test run picks random contacts without email/phone and attempts enrichment.

-- 1. Test runs — one row per test execution
CREATE TABLE IF NOT EXISTS enrichment_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_contacts integer NOT NULL DEFAULT 0,
  contacts_enriched integer NOT NULL DEFAULT 0,
  emails_found integer NOT NULL DEFAULT 0,
  phones_found integer NOT NULL DEFAULT 0,
  linkedin_resolved integer NOT NULL DEFAULT 0,
  success_rate numeric(5,2) DEFAULT 0,
  avg_enrichment_ms integer,
  errors jsonb DEFAULT '[]'::jsonb,
  triggered_by text DEFAULT 'manual',  -- 'manual', 'scheduled', 'api'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Individual test results — one row per contact attempted
CREATE TABLE IF NOT EXISTS enrichment_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid NOT NULL REFERENCES enrichment_test_runs(id) ON DELETE CASCADE,
  contact_id uuid,  -- from unified contacts table (nullable if from enriched_contacts)
  contact_name text NOT NULL,
  company_name text,
  contact_type text,  -- buyer, seller, advisor
  -- What we started with
  had_email_before boolean NOT NULL DEFAULT false,
  had_phone_before boolean NOT NULL DEFAULT false,
  had_linkedin_before boolean NOT NULL DEFAULT false,
  -- What we found
  email_found text,
  phone_found text,
  linkedin_found text,
  -- Enrichment details
  enrichment_source text,  -- 'prospeo_linkedin', 'prospeo_name', 'prospeo_domain', 'cache'
  confidence text CHECK (confidence IN ('high', 'medium', 'low')),
  enrichment_ms integer,
  -- Whether we saved back to the database
  saved_to_contacts boolean NOT NULL DEFAULT false,
  saved_to_enriched boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enrichment_test_runs_status ON enrichment_test_runs(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_test_runs_created ON enrichment_test_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_test_results_run ON enrichment_test_results(test_run_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_test_results_contact ON enrichment_test_results(contact_id);

-- RLS
ALTER TABLE enrichment_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_test_results ENABLE ROW LEVEL SECURITY;

-- Service role full access (tests run server-side)
DROP POLICY IF EXISTS enrichment_test_runs_service ON enrichment_test_runs;
DROP POLICY IF EXISTS enrichment_test_results_service ON enrichment_test_results;
CREATE POLICY enrichment_test_runs_service ON enrichment_test_runs FOR ALL USING (true);
CREATE POLICY enrichment_test_results_service ON enrichment_test_results FOR ALL USING (true);

-- View: enrichment success rate over time (for dashboards)
CREATE OR REPLACE VIEW enrichment_success_rate AS
SELECT
  date_trunc('day', started_at) AS test_date,
  count(*) AS runs,
  round(avg(success_rate), 2) AS avg_success_rate,
  sum(total_contacts) AS total_contacts_tested,
  sum(emails_found) AS total_emails_found,
  sum(phones_found) AS total_phones_found,
  round(avg(avg_enrichment_ms)) AS avg_ms_per_contact
FROM enrichment_test_runs
WHERE status = 'completed'
GROUP BY date_trunc('day', started_at)
ORDER BY test_date DESC;
