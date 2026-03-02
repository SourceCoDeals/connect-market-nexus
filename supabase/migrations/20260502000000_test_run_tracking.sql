-- ═══════════════════════════════════════════════════════════════
-- Migration: test_run_tracking
-- Date: 2026-05-02
-- Purpose: Creates tables for tracking Testing & Diagnostics runs,
--          so users can see historical results after navigating away.
--          Similar pattern to enrichment_test_runs / enrichment_test_results.
-- Tables affected: test_run_tracking, test_run_results
-- ═══════════════════════════════════════════════════════════════

-- 1. Test runs — one row per "Run All" or individual suite execution
CREATE TABLE IF NOT EXISTS test_run_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL DEFAULT 'run_all'
    CHECK (run_type IN ('run_all', 'system', 'docuseal', 'chatbot_infra', 'chatbot_scenarios', '30q', 'enrichment', 'smartlead', 'listing_pipeline', 'buyer_rec')),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  total_tests integer NOT NULL DEFAULT 0,
  passed integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  warnings integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  duration_ms integer,
  suites_completed integer DEFAULT 0,
  suites_total integer DEFAULT 0,
  error_summary jsonb DEFAULT '[]'::jsonb,
  triggered_by text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Individual test results — one row per test in a run
CREATE TABLE IF NOT EXISTS test_run_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES test_run_tracking(id) ON DELETE CASCADE,
  suite text NOT NULL,
  test_id text NOT NULL,
  test_name text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'pass', 'fail', 'warn', 'skip')),
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_test_run_tracking_status ON test_run_tracking(status);
CREATE INDEX IF NOT EXISTS idx_test_run_tracking_created ON test_run_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_run_tracking_run_type ON test_run_tracking(run_type);
CREATE INDEX IF NOT EXISTS idx_test_run_results_run_id ON test_run_results(run_id);
CREATE INDEX IF NOT EXISTS idx_test_run_results_suite ON test_run_results(suite);

-- RLS
ALTER TABLE test_run_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_run_results ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write (admin-only page, auth required)
DROP POLICY IF EXISTS test_run_tracking_auth ON test_run_tracking;
DROP POLICY IF EXISTS test_run_results_auth ON test_run_results;
CREATE POLICY test_run_tracking_auth ON test_run_tracking FOR ALL USING (true);
CREATE POLICY test_run_results_auth ON test_run_results FOR ALL USING (true);
