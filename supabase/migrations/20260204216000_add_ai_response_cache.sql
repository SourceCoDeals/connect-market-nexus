-- Add AI response caching to reduce costs and improve performance
-- Caches AI responses for identical prompts with configurable TTL

-- ============= CACHE TABLE =============

CREATE TABLE IF NOT EXISTS ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cache key (hash of prompt + model + provider)
  cache_key text NOT NULL UNIQUE,

  -- Request parameters
  provider text NOT NULL,
  model text NOT NULL,
  prompt_hash text NOT NULL, -- SHA256 of normalized prompt

  -- Cached response
  response_content text,
  response_tool_call jsonb,
  usage_tokens jsonb, -- {input: X, output: Y, total: Z}

  -- Cache metadata
  hit_count integer NOT NULL DEFAULT 0,
  last_hit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),

  -- Performance tracking
  original_duration_ms integer, -- Duration of original uncached call
  avg_savings_ms numeric -- Average time saved per cache hit
);

-- Indexes for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_response_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_response_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_provider_model ON ai_response_cache(provider, model);
CREATE INDEX IF NOT EXISTS idx_ai_cache_hit_count ON ai_response_cache(hit_count DESC);

COMMENT ON TABLE ai_response_cache IS
  'Caches AI API responses by prompt hash. Reduces costs and latency for repeated queries. Default TTL: 1 hour.';

-- ============= CACHE LOOKUP FUNCTION =============

/**
 * Look up cached AI response
 *
 * @param cache_key - Unique key for this prompt+model+provider combination
 * @returns Cached response or NULL if not found/expired
 */
CREATE OR REPLACE FUNCTION get_cached_ai_response(cache_key text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  cached_row ai_response_cache%ROWTYPE;
  result jsonb;
BEGIN
  -- Look up cache entry
  SELECT * INTO cached_row
  FROM ai_response_cache
  WHERE
    ai_response_cache.cache_key = get_cached_ai_response.cache_key
    AND expires_at > now()
  LIMIT 1;

  -- If not found, return NULL
  IF cached_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Update hit count and last hit time
  UPDATE ai_response_cache
  SET
    hit_count = hit_count + 1,
    last_hit_at = now()
  WHERE id = cached_row.id;

  -- Build result JSONB
  result := jsonb_build_object(
    'cache_hit', true,
    'content', cached_row.response_content,
    'tool_call', cached_row.response_tool_call,
    'usage', cached_row.usage_tokens,
    'hit_count', cached_row.hit_count + 1,
    'cached_at', cached_row.created_at
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_cached_ai_response IS
  'Look up cached AI response by cache key. Returns NULL if not found or expired. Increments hit count on cache hit.';

-- ============= CACHE STORE FUNCTION =============

/**
 * Store AI response in cache
 *
 * @param cache_key - Unique key for this response
 * @param provider - AI provider name
 * @param model - Model name
 * @param prompt_hash - SHA256 of normalized prompt
 * @param response_content - Text response from AI
 * @param response_tool_call - Tool call response (if any)
 * @param usage_tokens - Token usage {input, output, total}
 * @param duration_ms - Original call duration
 * @param ttl_hours - Time to live in hours (default 1)
 */
CREATE OR REPLACE FUNCTION store_ai_response_cache(
  cache_key text,
  provider text,
  model text,
  prompt_hash text,
  response_content text DEFAULT NULL,
  response_tool_call jsonb DEFAULT NULL,
  usage_tokens jsonb DEFAULT NULL,
  duration_ms integer DEFAULT NULL,
  ttl_hours integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  cache_id uuid;
BEGIN
  INSERT INTO ai_response_cache (
    cache_key,
    provider,
    model,
    prompt_hash,
    response_content,
    response_tool_call,
    usage_tokens,
    original_duration_ms,
    expires_at
  ) VALUES (
    cache_key,
    provider,
    model,
    prompt_hash,
    response_content,
    response_tool_call,
    usage_tokens,
    duration_ms,
    now() + (ttl_hours || ' hours')::interval
  )
  ON CONFLICT (cache_key) DO UPDATE SET
    -- Update if existing (refresh TTL)
    response_content = EXCLUDED.response_content,
    response_tool_call = EXCLUDED.response_tool_call,
    usage_tokens = EXCLUDED.usage_tokens,
    expires_at = now() + (ttl_hours || ' hours')::interval,
    hit_count = 0 -- Reset hit count on refresh
  RETURNING id INTO cache_id;

  RETURN cache_id;
END;
$$;

COMMENT ON FUNCTION store_ai_response_cache IS
  'Store AI response in cache with configurable TTL. Updates existing entry if cache_key already exists.';

-- ============= CACHE CLEANUP FUNCTION =============

/**
 * Clean up expired cache entries
 * Should be run periodically via cron
 */
CREATE OR REPLACE FUNCTION cleanup_expired_ai_cache()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM ai_response_cache
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % expired cache entries', deleted_count;
  END IF;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_ai_cache IS
  'Remove expired cache entries. Run periodically via cron to prevent table bloat.';

-- ============= CACHE STATISTICS VIEW =============

CREATE OR REPLACE VIEW ai_cache_stats AS
SELECT
  provider,
  model,
  COUNT(*) as cached_responses,
  SUM(hit_count) as total_hits,
  ROUND(AVG(hit_count), 2) as avg_hits_per_entry,
  SUM(hit_count * (usage_tokens->>'total')::integer) as estimated_tokens_saved,
  ROUND(SUM(hit_count * original_duration_ms) / 1000.0, 2) as estimated_time_saved_seconds,
  MAX(hit_count) as max_hits,
  COUNT(*) FILTER (WHERE hit_count > 0) as entries_with_hits,
  COUNT(*) FILTER (WHERE hit_count = 0) as entries_never_hit
FROM ai_response_cache
WHERE expires_at > now() -- Only count active cache entries
GROUP BY provider, model
ORDER BY total_hits DESC;

COMMENT ON VIEW ai_cache_stats IS
  'Statistics on AI response cache effectiveness. Shows cache hits, tokens saved, and time saved per provider/model.';

-- ============= CACHE EFFECTIVENESS VIEW =============

CREATE OR REPLACE VIEW ai_cache_effectiveness AS
WITH cache_metrics AS (
  SELECT
    DATE(created_at) as date,
    provider,
    COUNT(*) as cache_entries,
    SUM(hit_count) as cache_hits,
    SUM(hit_count * (usage_tokens->>'total')::integer) as tokens_saved
  FROM ai_response_cache
  WHERE created_at > now() - interval '30 days'
  GROUP BY DATE(created_at), provider
),
call_metrics AS (
  SELECT
    DATE(created_at) as date,
    provider,
    COUNT(*) as total_calls
  FROM ai_api_calls
  WHERE created_at > now() - interval '30 days'
  GROUP BY DATE(created_at), provider
)
SELECT
  COALESCE(cm.date, am.date) as date,
  COALESCE(cm.provider, am.provider) as provider,
  COALESCE(am.total_calls, 0) as total_ai_calls,
  COALESCE(cm.cache_hits, 0) as cache_hits,
  COALESCE(cm.cache_entries, 0) as new_cache_entries,
  COALESCE(cm.tokens_saved, 0) as tokens_saved,
  CASE
    WHEN COALESCE(am.total_calls, 0) > 0
    THEN ROUND(100.0 * COALESCE(cm.cache_hits, 0) / am.total_calls, 2)
    ELSE 0
  END as cache_hit_rate_percent
FROM cache_metrics cm
FULL OUTER JOIN call_metrics am ON cm.date = am.date AND cm.provider = am.provider
ORDER BY date DESC, provider;

COMMENT ON VIEW ai_cache_effectiveness IS
  'Daily cache effectiveness metrics. Shows cache hit rate and tokens saved. Use to evaluate cache ROI.';

-- ============= SCHEDULE CACHE CLEANUP =============

-- Clean up expired cache entries every hour
SELECT cron.schedule(
  'cleanup-expired-ai-cache',
  '0 * * * *', -- Every hour
  $$SELECT cleanup_expired_ai_cache();$$
);

-- ============= CACHE CONFIGURATION TABLE =============

CREATE TABLE IF NOT EXISTS ai_cache_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ai_cache_config (setting_key, setting_value, description) VALUES
  ('default_ttl_hours', '1', 'Default cache TTL in hours for AI responses'),
  ('max_cache_entries', '10000', 'Maximum number of cache entries before cleanup'),
  ('enable_cache', 'true', 'Global cache enable/disable flag'),
  ('cache_tool_calls', 'true', 'Whether to cache tool call responses'),
  ('cache_text_responses', 'true', 'Whether to cache text responses')
ON CONFLICT (setting_key) DO NOTHING;

COMMENT ON TABLE ai_cache_config IS
  'Configuration settings for AI response cache. Modify these to tune cache behavior.';
