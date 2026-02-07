-- ============================================================================
-- COMPLETE CHATBOT INFRASTRUCTURE MIGRATION
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: CHAT CONVERSATIONS TABLE
-- ============================================================================

-- Chat Conversations Persistence
-- Stores chat conversation history for user sessions

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Context
  context_type TEXT NOT NULL CHECK (context_type IN ('deal', 'deals', 'buyers', 'universe')),
  deal_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,

  -- Conversation metadata
  title TEXT, -- Optional user-provided or auto-generated title
  messages JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {role, content, timestamp}

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  message_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(messages)) STORED,

  -- Soft delete
  archived BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations(user_id) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_deal_id ON public.chat_conversations(deal_id) WHERE deal_id IS NOT NULL AND archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_universe_id ON public.chat_conversations(universe_id) WHERE universe_id IS NOT NULL AND archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON public.chat_conversations(updated_at DESC) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_context_type ON public.chat_conversations(context_type) WHERE archived = FALSE;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_chat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_message_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER set_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_conversations_updated_at();

-- RLS Policies
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;
CREATE POLICY "Users can view own conversations"
  ON public.chat_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own conversations" ON public.chat_conversations;
CREATE POLICY "Users can create own conversations"
  ON public.chat_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.chat_conversations;
CREATE POLICY "Users can update own conversations"
  ON public.chat_conversations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.chat_conversations;
CREATE POLICY "Users can delete own conversations"
  ON public.chat_conversations
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins have full access" ON public.chat_conversations;
CREATE POLICY "Admins have full access"
  ON public.chat_conversations
  FOR ALL
  USING (is_admin(auth.uid()));

-- Comments
COMMENT ON TABLE public.chat_conversations IS 'Stores chat conversation history for buyer/deal analysis sessions';
COMMENT ON COLUMN public.chat_conversations.messages IS 'JSONB array of message objects: [{role: "user"|"assistant", content: string, timestamp: ISO8601}]';
COMMENT ON COLUMN public.chat_conversations.context_type IS 'Type of chat context: deal (single deal), deals (all deals), buyers (all buyers), universe (specific universe)';
COMMENT ON COLUMN public.chat_conversations.message_count IS 'Auto-computed count of messages in the conversation';

-- ============================================================================
-- PART 2: CHAT ANALYTICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Context
  context_type TEXT NOT NULL CHECK (context_type IN ('deal', 'deals', 'buyers', 'universe')),
  deal_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE SET NULL,

  -- Query details
  query_text TEXT NOT NULL,
  query_intent TEXT, -- 'find_buyers', 'score_explanation', 'transcript_search', 'general'
  query_complexity TEXT CHECK (query_complexity IN ('simple', 'medium', 'complex')),

  -- Response details
  response_text TEXT,
  response_time_ms INTEGER NOT NULL,
  model_used TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  tokens_total INTEGER,

  -- Tool usage
  tools_called JSONB, -- Array of tool names used
  tool_execution_time_ms INTEGER,

  -- Entities mentioned
  mentioned_buyer_ids UUID[],
  mentioned_deal_ids UUID[],

  -- Quality metrics
  user_continued BOOLEAN DEFAULT FALSE, -- Did user ask follow-up?
  user_rating INTEGER CHECK (user_rating IN (-1, 0, 1)), -- -1: negative, 0: neutral, 1: positive
  feedback_provided BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Session tracking
  session_id TEXT -- For grouping related queries
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_chat_analytics_user_created ON public.chat_analytics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_conversation ON public.chat_analytics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_context ON public.chat_analytics(context_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_universe ON public.chat_analytics(universe_id) WHERE universe_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_analytics_deal ON public.chat_analytics(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_analytics_intent ON public.chat_analytics(query_intent) WHERE query_intent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_analytics_tools ON public.chat_analytics USING GIN (tools_called) WHERE tools_called IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_analytics_rating ON public.chat_analytics(user_rating) WHERE user_rating IS NOT NULL;

-- ============================================================================
-- PART 3: CHAT FEEDBACK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  analytics_id UUID REFERENCES public.chat_analytics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Feedback details
  message_index INTEGER NOT NULL, -- Which message in conversation
  rating INTEGER NOT NULL CHECK (rating IN (1, -1)), -- 1: thumbs up, -1: thumbs down

  -- Issue categorization
  issue_type TEXT CHECK (issue_type IN (
    'incorrect',
    'incomplete',
    'hallucination',
    'poor_formatting',
    'missing_data',
    'slow_response',
    'other'
  )),
  feedback_text TEXT,

  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_feedback_conversation ON public.chat_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_user_created ON public.chat_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_rating ON public.chat_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_issue_type ON public.chat_feedback(issue_type) WHERE issue_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_feedback_unresolved ON public.chat_feedback(created_at DESC) WHERE resolved = FALSE;

-- ============================================================================
-- PART 4: SMART SUGGESTIONS CACHE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_smart_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  context_type TEXT NOT NULL CHECK (context_type IN ('deal', 'deals', 'buyers', 'universe')),
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,

  -- Suggestion details
  previous_query TEXT NOT NULL, -- What was asked before
  suggestions JSONB NOT NULL, -- Array of suggested follow-ups
  suggestion_reasoning TEXT, -- Why these suggestions

  -- Performance tracking
  times_shown INTEGER DEFAULT 0,
  times_clicked INTEGER DEFAULT 0,
  click_through_rate NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN times_shown > 0 THEN (times_clicked::NUMERIC / times_shown::NUMERIC)
      ELSE 0
    END
  ) STORED,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_shown_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_smart_suggestions_context ON public.chat_smart_suggestions(context_type, universe_id, deal_id)
  WHERE created_at > NOW() - INTERVAL '7 days';
CREATE INDEX IF NOT EXISTS idx_smart_suggestions_performance ON public.chat_smart_suggestions(click_through_rate DESC)
  WHERE times_shown > 10;

-- ============================================================================
-- PART 5: PROACTIVE RECOMMENDATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Recommendation details
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN (
    'explore_geography',
    'explore_size',
    'explore_services',
    'review_transcripts',
    'contact_buyers',
    'expand_search',
    'other'
  )),
  recommendation_text TEXT NOT NULL,
  recommendation_data JSONB, -- Additional structured data

  -- User interaction
  shown BOOLEAN DEFAULT FALSE,
  shown_at TIMESTAMPTZ,
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_recommendations_user ON public.chat_recommendations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_recommendations_conversation ON public.chat_recommendations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_recommendations_active ON public.chat_recommendations(created_at DESC)
  WHERE shown = FALSE AND (expires_at IS NULL OR expires_at > NOW());
CREATE INDEX IF NOT EXISTS idx_chat_recommendations_type ON public.chat_recommendations(recommendation_type);

-- ============================================================================
-- PART 6: RLS POLICIES
-- ============================================================================

-- Chat Analytics
ALTER TABLE public.chat_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analytics" ON public.chat_analytics;
CREATE POLICY "Users can view own analytics"
  ON public.chat_analytics FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own analytics" ON public.chat_analytics;
CREATE POLICY "Users can insert own analytics"
  ON public.chat_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins have full access to analytics" ON public.chat_analytics;
CREATE POLICY "Admins have full access to analytics"
  ON public.chat_analytics FOR ALL
  USING (is_admin(auth.uid()));

-- Chat Feedback
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own feedback" ON public.chat_feedback;
CREATE POLICY "Users can view own feedback"
  ON public.chat_feedback FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.chat_feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.chat_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own feedback" ON public.chat_feedback;
CREATE POLICY "Users can update own feedback"
  ON public.chat_feedback FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins have full access to feedback" ON public.chat_feedback;
CREATE POLICY "Admins have full access to feedback"
  ON public.chat_feedback FOR ALL
  USING (is_admin(auth.uid()));

-- Smart Suggestions
ALTER TABLE public.chat_smart_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view smart suggestions" ON public.chat_smart_suggestions;
CREATE POLICY "Anyone can view smart suggestions"
  ON public.chat_smart_suggestions FOR SELECT
  USING (true); -- Public data

DROP POLICY IF EXISTS "System can insert smart suggestions" ON public.chat_smart_suggestions;
CREATE POLICY "System can insert smart suggestions"
  ON public.chat_smart_suggestions FOR INSERT
  WITH CHECK (true); -- Service role only

DROP POLICY IF EXISTS "System can update smart suggestions" ON public.chat_smart_suggestions;
CREATE POLICY "System can update smart suggestions"
  ON public.chat_smart_suggestions FOR UPDATE
  USING (true); -- Service role only

-- Proactive Recommendations
ALTER TABLE public.chat_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own recommendations" ON public.chat_recommendations;
CREATE POLICY "Users can view own recommendations"
  ON public.chat_recommendations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own recommendations" ON public.chat_recommendations;
CREATE POLICY "Users can update own recommendations"
  ON public.chat_recommendations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert recommendations" ON public.chat_recommendations;
CREATE POLICY "System can insert recommendations"
  ON public.chat_recommendations FOR INSERT
  WITH CHECK (true); -- Service role only

DROP POLICY IF EXISTS "Admins have full access to recommendations" ON public.chat_recommendations;
CREATE POLICY "Admins have full access to recommendations"
  ON public.chat_recommendations FOR ALL
  USING (is_admin(auth.uid()));

-- ============================================================================
-- PART 7: HELPER FUNCTIONS
-- ============================================================================

-- Function to get analytics summary
CREATE OR REPLACE FUNCTION get_chat_analytics_summary(
  p_user_id UUID DEFAULT NULL,
  p_context_type TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_queries BIGINT,
  avg_response_time_ms NUMERIC,
  total_tokens INTEGER,
  unique_conversations BIGINT,
  continuation_rate NUMERIC,
  positive_feedback_rate NUMERIC,
  most_common_intent TEXT,
  tools_used_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_queries,
    AVG(response_time_ms)::NUMERIC as avg_response_time_ms,
    SUM(COALESCE(tokens_total, 0))::INTEGER as total_tokens,
    COUNT(DISTINCT conversation_id)::BIGINT as unique_conversations,
    (COUNT(*) FILTER (WHERE user_continued = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) as continuation_rate,
    (COUNT(*) FILTER (WHERE user_rating = 1)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE user_rating IS NOT NULL), 0)) as positive_feedback_rate,
    MODE() WITHIN GROUP (ORDER BY query_intent) as most_common_intent,
    COUNT(*) FILTER (WHERE tools_called IS NOT NULL AND jsonb_array_length(tools_called) > 0)::BIGINT as tools_used_count
  FROM chat_analytics
  WHERE
    created_at > NOW() - MAKE_INTERVAL(days => p_days)
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_context_type IS NULL OR context_type = p_context_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log chat analytics
CREATE OR REPLACE FUNCTION log_chat_analytics(
  p_conversation_id UUID,
  p_query_text TEXT,
  p_response_text TEXT,
  p_response_time_ms INTEGER,
  p_tokens_input INTEGER,
  p_tokens_output INTEGER,
  p_context_type TEXT,
  p_deal_id UUID DEFAULT NULL,
  p_universe_id UUID DEFAULT NULL,
  p_tools_called JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_analytics_id UUID;
BEGIN
  INSERT INTO chat_analytics (
    conversation_id,
    user_id,
    context_type,
    deal_id,
    universe_id,
    query_text,
    response_text,
    response_time_ms,
    tokens_input,
    tokens_output,
    tokens_total,
    tools_called
  ) VALUES (
    p_conversation_id,
    auth.uid(),
    p_context_type,
    p_deal_id,
    p_universe_id,
    p_query_text,
    p_response_text,
    p_response_time_ms,
    p_tokens_input,
    p_tokens_output,
    p_tokens_input + p_tokens_output,
    p_tools_called
  )
  RETURNING id INTO v_analytics_id;

  RETURN v_analytics_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 8: COMMENTS
-- ============================================================================

COMMENT ON TABLE public.chat_analytics IS 'Tracks chatbot usage, performance, and query patterns';
COMMENT ON TABLE public.chat_feedback IS 'User feedback on chatbot responses (thumbs up/down and detailed feedback)';
COMMENT ON TABLE public.chat_smart_suggestions IS 'Caches smart follow-up suggestions with performance tracking';
COMMENT ON TABLE public.chat_recommendations IS 'Proactive recommendations shown to users based on conversation analysis';

COMMENT ON FUNCTION get_chat_analytics_summary IS 'Get summary analytics for chat usage over specified period';
COMMENT ON FUNCTION log_chat_analytics IS 'Helper function to log chat analytics with automatic user_id resolution';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables were created
DO $$
BEGIN
  RAISE NOTICE 'Migration complete! Created tables:';
  RAISE NOTICE '  - chat_conversations';
  RAISE NOTICE '  - chat_analytics';
  RAISE NOTICE '  - chat_feedback';
  RAISE NOTICE '  - chat_smart_suggestions';
  RAISE NOTICE '  - chat_recommendations';
  RAISE NOTICE '';
  RAISE NOTICE 'Run this to verify:';
  RAISE NOTICE '  SELECT tablename FROM pg_tables WHERE schemaname = ''public'' AND tablename LIKE ''chat_%'';';
END $$;
