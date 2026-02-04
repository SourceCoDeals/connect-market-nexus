-- Add cost tracking for AI API calls
-- Tracks usage, costs, and helps identify optimization opportunities

-- ============= COST TRACKING TABLE =============

CREATE TABLE IF NOT EXISTS ai_api_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider information
  provider text NOT NULL, -- 'gemini', 'claude', 'openai'
  model text NOT NULL, -- Specific model used

  -- Request context
  function_name text NOT NULL, -- Which edge function made the call
  request_id text, -- Optional request tracking ID
  user_id uuid, -- Optional user attribution

  -- Token usage
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  -- Cost calculation (in USD)
  input_cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  output_cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  total_cost_usd numeric(10, 6) NOT NULL GENERATED ALWAYS AS (input_cost_usd + output_cost_usd) STORED,

  -- Request metadata
  success boolean NOT NULL DEFAULT true,
  error_code text,
  error_message text,
  retry_count integer DEFAULT 0,
  duration_ms integer, -- Request duration in milliseconds

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_api_calls_created_at ON ai_api_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_api_calls_provider ON ai_api_calls(provider);
CREATE INDEX IF NOT EXISTS idx_ai_api_calls_function_name ON ai_api_calls(function_name);
CREATE INDEX IF NOT EXISTS idx_ai_api_calls_success ON ai_api_calls(success);
CREATE INDEX IF NOT EXISTS idx_ai_api_calls_user_id ON ai_api_calls(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE ai_api_calls IS
  'Tracks all AI API calls with token usage and cost data. Use for billing, optimization, and monitoring.';

-- ============= COST SUMMARY VIEW =============

CREATE OR REPLACE VIEW ai_cost_summary AS
SELECT
  provider,
  function_name,
  DATE(created_at) as date,
  COUNT(*) as call_count,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_calls,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_calls,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(total_cost_usd) as total_cost_usd,
  AVG(duration_ms) as avg_duration_ms,
  AVG(total_tokens) as avg_tokens_per_call
FROM ai_api_calls
GROUP BY provider, function_name, DATE(created_at)
ORDER BY date DESC, total_cost_usd DESC;

COMMENT ON VIEW ai_cost_summary IS
  'Daily summary of AI API costs by provider and function. Use for billing reports and cost analysis.';

-- ============= REAL-TIME COST TRACKING VIEW =============

CREATE OR REPLACE VIEW ai_cost_last_24h AS
SELECT
  provider,
  COUNT(*) as calls,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
  SUM(total_tokens) as total_tokens,
  ROUND(SUM(total_cost_usd)::numeric, 4) as cost_usd,
  ROUND(AVG(duration_ms)::numeric, 0) as avg_duration_ms,
  MAX(created_at) as last_call
FROM ai_api_calls
WHERE created_at > now() - interval '24 hours'
GROUP BY provider
ORDER BY cost_usd DESC;

COMMENT ON VIEW ai_cost_last_24h IS
  'Real-time cost tracking for last 24 hours by provider. Use for live monitoring.';

-- ============= COST ANALYSIS FUNCTIONS =============

-- Function to get cost breakdown by time period
CREATE OR REPLACE FUNCTION get_ai_cost_breakdown(
  period_hours integer DEFAULT 24,
  provider_filter text DEFAULT NULL
)
RETURNS TABLE(
  provider text,
  model text,
  function_name text,
  calls bigint,
  total_tokens bigint,
  cost_usd numeric,
  avg_cost_per_call numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    provider,
    model,
    function_name,
    COUNT(*) as calls,
    SUM(total_tokens) as total_tokens,
    ROUND(SUM(total_cost_usd)::numeric, 4) as cost_usd,
    ROUND(AVG(total_cost_usd)::numeric, 6) as avg_cost_per_call
  FROM ai_api_calls
  WHERE
    created_at > now() - (period_hours || ' hours')::interval
    AND (provider_filter IS NULL OR provider = provider_filter)
  GROUP BY provider, model, function_name
  ORDER BY cost_usd DESC;
$$;

COMMENT ON FUNCTION get_ai_cost_breakdown IS
  'Get detailed cost breakdown by provider, model, and function for specified time period (default 24h).';

-- Function to calculate projected monthly cost
CREATE OR REPLACE FUNCTION get_projected_monthly_cost()
RETURNS TABLE(
  provider text,
  last_24h_cost numeric,
  projected_monthly_cost numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    provider,
    ROUND(SUM(total_cost_usd)::numeric, 2) as last_24h_cost,
    ROUND((SUM(total_cost_usd) * 30)::numeric, 2) as projected_monthly_cost
  FROM ai_api_calls
  WHERE created_at > now() - interval '24 hours'
  GROUP BY provider
  ORDER BY projected_monthly_cost DESC;
$$;

COMMENT ON FUNCTION get_projected_monthly_cost IS
  'Project monthly AI costs based on last 24 hours of usage. Use for budget planning.';

-- ============= COST ALERTS =============

-- Table for cost threshold alerts
CREATE TABLE IF NOT EXISTS ai_cost_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL, -- 'daily', 'hourly', 'per_call'
  provider text, -- NULL = all providers
  threshold_usd numeric(10, 2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ai_cost_alerts IS
  'Configure cost alert thresholds. Alerts trigger when spending exceeds defined limits.';

-- Function to check if cost alerts should trigger
CREATE OR REPLACE FUNCTION check_ai_cost_alerts()
RETURNS TABLE(
  alert_id uuid,
  alert_type text,
  provider text,
  threshold_usd numeric,
  current_spend numeric,
  exceeded_by numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH hourly_costs AS (
    SELECT
      provider,
      SUM(total_cost_usd) as cost_usd
    FROM ai_api_calls
    WHERE created_at > now() - interval '1 hour'
    GROUP BY provider
  ),
  daily_costs AS (
    SELECT
      provider,
      SUM(total_cost_usd) as cost_usd
    FROM ai_api_calls
    WHERE created_at > now() - interval '24 hours'
    GROUP BY provider
  )
  SELECT
    a.id,
    a.alert_type,
    a.provider,
    a.threshold_usd,
    CASE
      WHEN a.alert_type = 'hourly' THEN ROUND(COALESCE(h.cost_usd, 0)::numeric, 4)
      WHEN a.alert_type = 'daily' THEN ROUND(COALESCE(d.cost_usd, 0)::numeric, 4)
      ELSE 0
    END as current_spend,
    CASE
      WHEN a.alert_type = 'hourly' THEN ROUND((COALESCE(h.cost_usd, 0) - a.threshold_usd)::numeric, 4)
      WHEN a.alert_type = 'daily' THEN ROUND((COALESCE(d.cost_usd, 0) - a.threshold_usd)::numeric, 4)
      ELSE 0
    END as exceeded_by
  FROM ai_cost_alerts a
  LEFT JOIN hourly_costs h ON (a.provider IS NULL OR a.provider = h.provider)
  LEFT JOIN daily_costs d ON (a.provider IS NULL OR a.provider = d.provider)
  WHERE
    a.is_active
    AND (
      (a.alert_type = 'hourly' AND COALESCE(h.cost_usd, 0) > a.threshold_usd)
      OR (a.alert_type = 'daily' AND COALESCE(d.cost_usd, 0) > a.threshold_usd)
    );
END;
$$;

COMMENT ON FUNCTION check_ai_cost_alerts IS
  'Check if any cost alerts should trigger based on current spending. Returns alerts that have been exceeded.';

-- ============= DEFAULT PRICING (as of 2026-02) =============
-- Insert default pricing rates for reference

COMMENT ON TABLE ai_api_calls IS
  'Tracks all AI API calls with token usage and cost data.

PRICING REFERENCE (Update periodically):
- Gemini Flash 2.0: $0.075/$0.30 per 1M tokens (input/output)
- Claude Sonnet 4.5: $3/$15 per 1M tokens (input/output)
- GPT-4o: $2.50/$10 per 1M tokens (input/output)
- GPT-4o-mini: $0.15/$0.60 per 1M tokens (input/output)

Cost calculation should be done in application code using these rates.';
