-- Migration: Create Webhook System for Transcript Extraction
-- Purpose: Enable webhook notifications for extraction events
-- Author: Phase 2 Architectural Consolidation
-- Date: 2026-02-05

-- ============================================================================
-- STEP 1: Create webhook_configs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  universe_id UUID REFERENCES universes(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Configuration
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  secret TEXT, -- For HMAC signing (optional)
  enabled BOOLEAN DEFAULT TRUE,

  -- Event filters
  event_types TEXT[] DEFAULT ARRAY[
    'extraction.completed',
    'extraction.failed',
    'ceo.detected'
  ],
  entity_types TEXT[] DEFAULT ARRAY['buyer', 'deal', 'call', 'both'], -- Filter by transcript type

  -- Headers (for authentication)
  custom_headers JSONB DEFAULT '{}'::jsonb,

  -- Retry configuration
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 2,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  total_deliveries INTEGER DEFAULT 0,
  total_failures INTEGER DEFAULT 0
);

-- ============================================================================
-- STEP 2: Create webhook_deliveries table (delivery log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  webhook_config_id UUID REFERENCES webhook_configs(id) ON DELETE CASCADE,
  transcript_id UUID REFERENCES transcripts(id) ON DELETE SET NULL,

  -- Event details
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery attempt
  attempt_number INTEGER DEFAULT 1,
  status TEXT CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
  http_status_code INTEGER,
  response_body TEXT,
  error_message TEXT,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ
);

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_webhook_configs_universe
  ON webhook_configs(universe_id)
  WHERE universe_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_configs_enabled
  ON webhook_configs(enabled)
  WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_config
  ON webhook_deliveries(webhook_config_id);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_transcript
  ON webhook_deliveries(transcript_id)
  WHERE transcript_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status
  ON webhook_deliveries(status);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending_retry
  ON webhook_deliveries(next_retry_at)
  WHERE status = 'retrying' AND next_retry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created
  ON webhook_deliveries(created_at DESC);

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON TABLE webhook_configs IS 'Webhook configuration for transcript extraction events. Enables integration with Zapier, Make, custom APIs, etc.';
COMMENT ON COLUMN webhook_configs.secret IS 'Optional secret for HMAC-SHA256 signing of webhook payloads (sent as X-Webhook-Signature header)';
COMMENT ON COLUMN webhook_configs.event_types IS 'Array of event types to subscribe to: extraction.completed, extraction.failed, ceo.detected, etc.';
COMMENT ON COLUMN webhook_configs.custom_headers IS 'Custom HTTP headers to send with webhook (e.g., {"Authorization": "Bearer token"})';

COMMENT ON TABLE webhook_deliveries IS 'Delivery log for webhook events. Tracks all webhook delivery attempts with retry information.';
COMMENT ON COLUMN webhook_deliveries.attempt_number IS 'Which retry attempt this is (1 = first attempt)';
COMMENT ON COLUMN webhook_deliveries.next_retry_at IS 'Scheduled time for next retry if delivery failed';

-- ============================================================================
-- STEP 5: Enable RLS
-- ============================================================================

ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can manage webhook configs
CREATE POLICY "Admin users can manage webhook configs"
  ON webhook_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admin users can view webhook deliveries
CREATE POLICY "Admin users can view webhook deliveries"
  ON webhook_deliveries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Service role full access (for edge functions)
CREATE POLICY "Service role full access to webhooks"
  ON webhook_configs
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to deliveries"
  ON webhook_deliveries
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 6: Create trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_webhook_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_webhook_configs_updated_at
  BEFORE UPDATE ON webhook_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_configs_updated_at();

-- ============================================================================
-- STEP 7: Create helper functions
-- ============================================================================

-- Function to get active webhooks for an event
CREATE OR REPLACE FUNCTION get_active_webhooks_for_event(
  p_event_type TEXT,
  p_entity_type TEXT,
  p_universe_id UUID DEFAULT NULL
)
RETURNS SETOF webhook_configs AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM webhook_configs
  WHERE enabled = TRUE
    AND p_event_type = ANY(event_types)
    AND p_entity_type = ANY(entity_types)
    AND (universe_id IS NULL OR universe_id = p_universe_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_webhooks_for_event IS 'Get all active webhook configurations that should receive a specific event type';

-- Function to record webhook delivery
CREATE OR REPLACE FUNCTION record_webhook_delivery(
  p_webhook_config_id UUID,
  p_transcript_id UUID,
  p_event_type TEXT,
  p_payload JSONB,
  p_status TEXT,
  p_http_status_code INTEGER DEFAULT NULL,
  p_response_body TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_attempt_number INTEGER DEFAULT 1
)
RETURNS UUID AS $$
DECLARE
  delivery_id UUID;
  next_retry TIMESTAMPTZ;
BEGIN
  -- Calculate next retry time if failed
  IF p_status = 'failed' THEN
    -- Exponential backoff: 2^attempt * 2 seconds
    next_retry := NOW() + (POWER(2, p_attempt_number) * INTERVAL '2 seconds');
  END IF;

  -- Insert delivery record
  INSERT INTO webhook_deliveries (
    webhook_config_id,
    transcript_id,
    event_type,
    payload,
    attempt_number,
    status,
    http_status_code,
    response_body,
    error_message,
    delivered_at,
    next_retry_at
  ) VALUES (
    p_webhook_config_id,
    p_transcript_id,
    p_event_type,
    p_payload,
    p_attempt_number,
    p_status,
    p_http_status_code,
    p_response_body,
    p_error_message,
    CASE WHEN p_status = 'delivered' THEN NOW() ELSE NULL END,
    CASE WHEN p_status IN ('failed', 'retrying') THEN next_retry ELSE NULL END
  )
  RETURNING id INTO delivery_id;

  -- Update webhook_configs stats
  UPDATE webhook_configs
  SET
    last_triggered_at = NOW(),
    total_deliveries = total_deliveries + 1,
    total_failures = total_failures + CASE WHEN p_status = 'failed' THEN 1 ELSE 0 END
  WHERE id = p_webhook_config_id;

  RETURN delivery_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_webhook_delivery IS 'Record a webhook delivery attempt with retry scheduling';

-- ============================================================================
-- STEP 8: Create view for webhook analytics
-- ============================================================================

CREATE OR REPLACE VIEW webhook_delivery_stats AS
SELECT
  wc.id as webhook_config_id,
  wc.name as webhook_name,
  wc.webhook_url,
  wc.enabled,
  COUNT(wd.id) as total_attempts,
  COUNT(wd.id) FILTER (WHERE wd.status = 'delivered') as successful_deliveries,
  COUNT(wd.id) FILTER (WHERE wd.status = 'failed') as failed_deliveries,
  COUNT(wd.id) FILTER (WHERE wd.status = 'retrying') as retrying_deliveries,
  ROUND(100.0 * COUNT(wd.id) FILTER (WHERE wd.status = 'delivered') / NULLIF(COUNT(wd.id), 0), 2) as success_rate_percentage,
  MAX(wd.created_at) as last_delivery_attempt,
  AVG(EXTRACT(EPOCH FROM (wd.delivered_at - wd.created_at))) as avg_delivery_time_seconds
FROM webhook_configs wc
LEFT JOIN webhook_deliveries wd ON wd.webhook_config_id = wc.id
GROUP BY wc.id, wc.name, wc.webhook_url, wc.enabled;

COMMENT ON VIEW webhook_delivery_stats IS 'Analytics view showing webhook delivery success rates and performance metrics';

-- ============================================================================
-- FINAL REPORT
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE E'\n========================================';
  RAISE NOTICE 'WEBHOOK SYSTEM CREATED';
  RAISE NOTICE E'========================================\n';
  RAISE NOTICE 'Tables:';
  RAISE NOTICE '  - webhook_configs (webhook configuration)';
  RAISE NOTICE '  - webhook_deliveries (delivery log with retries)';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions:';
  RAISE NOTICE '  - get_active_webhooks_for_event()';
  RAISE NOTICE '  - record_webhook_delivery()';
  RAISE NOTICE '';
  RAISE NOTICE 'Views:';
  RAISE NOTICE '  - webhook_delivery_stats (analytics)';
  RAISE NOTICE '';
  RAISE NOTICE 'Supported events:';
  RAISE NOTICE '  - extraction.completed';
  RAISE NOTICE '  - extraction.failed';
  RAISE NOTICE '  - ceo.detected';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Implement webhook delivery in extract-transcript edge function';
END $$;
