-- AI Command Center - Usage tracking and action audit tables
-- Tracks token usage, costs, and all actions taken through the AI assistant.

-- Usage tracking per interaction
CREATE TABLE IF NOT EXISTS ai_command_center_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  conversation_id TEXT,
  query TEXT NOT NULL,
  category TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10, 6) NOT NULL DEFAULT 0,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  router_bypassed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user-level analytics and billing
CREATE INDEX idx_ai_cc_usage_user_date ON ai_command_center_usage (user_id, created_at DESC);
CREATE INDEX idx_ai_cc_usage_category ON ai_command_center_usage (category, created_at DESC);

-- Row-level security: users can only see their own usage
ALTER TABLE ai_command_center_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI usage"
  ON ai_command_center_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert AI usage"
  ON ai_command_center_usage
  FOR INSERT
  WITH CHECK (true);

-- Action audit log for all write actions taken via AI Command Center
CREATE TABLE IF NOT EXISTS ai_command_center_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  conversation_id TEXT,
  tool_name TEXT NOT NULL,
  tool_args JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_cc_actions_user ON ai_command_center_actions (user_id, created_at DESC);
CREATE INDEX idx_ai_cc_actions_tool ON ai_command_center_actions (tool_name, created_at DESC);

ALTER TABLE ai_command_center_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI actions"
  ON ai_command_center_actions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert AI actions"
  ON ai_command_center_actions
  FOR INSERT
  WITH CHECK (true);
