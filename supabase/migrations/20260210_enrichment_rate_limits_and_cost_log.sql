-- Rate limit coordination table
-- Tracks per-provider rate limit state so edge functions can coordinate
CREATE TABLE IF NOT EXISTS enrichment_rate_limits (
  provider TEXT PRIMARY KEY,  -- 'anthropic', 'gemini', 'openai', 'firecrawl', 'apify'
  concurrent_requests INTEGER DEFAULT 0,
  backoff_until TIMESTAMPTZ DEFAULT NULL,
  last_429_at TIMESTAMPTZ DEFAULT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial rows for each provider
INSERT INTO enrichment_rate_limits (provider) VALUES
  ('anthropic'),
  ('gemini'),
  ('openai'),
  ('firecrawl'),
  ('apify')
ON CONFLICT (provider) DO NOTHING;

-- Atomic increment for concurrent request tracking
CREATE OR REPLACE FUNCTION increment_provider_concurrent(p_provider TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO enrichment_rate_limits (provider, concurrent_requests, updated_at)
  VALUES (p_provider, 1, now())
  ON CONFLICT (provider) DO UPDATE
  SET concurrent_requests = enrichment_rate_limits.concurrent_requests + 1,
      updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Atomic decrement for concurrent request tracking
CREATE OR REPLACE FUNCTION decrement_provider_concurrent(p_provider TEXT)
RETURNS void AS $$
BEGIN
  UPDATE enrichment_rate_limits
  SET concurrent_requests = GREATEST(0, concurrent_requests - 1),
      updated_at = now()
  WHERE provider = p_provider;
END;
$$ LANGUAGE plpgsql;

-- Auto-reset stale concurrent counts (if a function dies without decrementing)
-- Any concurrent_requests > 0 that haven't been updated in 5 minutes are stale
CREATE OR REPLACE FUNCTION reset_stale_concurrent_counts()
RETURNS void AS $$
BEGIN
  UPDATE enrichment_rate_limits
  SET concurrent_requests = 0, updated_at = now()
  WHERE concurrent_requests > 0
    AND updated_at < now() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Cost tracking table
CREATE TABLE IF NOT EXISTS enrichment_cost_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
  duration_ms INTEGER DEFAULT NULL,
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying cost by time period and provider
CREATE INDEX IF NOT EXISTS idx_cost_log_created_at ON enrichment_cost_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_log_provider ON enrichment_cost_log (provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_log_function ON enrichment_cost_log (function_name, created_at DESC);

-- Enable RLS (service role bypasses, no user access needed)
ALTER TABLE enrichment_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_cost_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role access" ON enrichment_rate_limits FOR ALL USING (true);
CREATE POLICY "Service role access" ON enrichment_cost_log FOR ALL USING (true);
