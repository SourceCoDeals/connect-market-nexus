-- ============================================================================
-- COMPLETE CHATBOT INFRASTRUCTURE MIGRATION (V2)
-- Handles ALL existing tables and adds missing columns
-- ============================================================================

-- ============================================================================
-- PART 1: CHAT CONVERSATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL,
  deal_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

-- Add ALL missing columns for chat_conversations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_conversations' AND column_name = 'archived') THEN
    ALTER TABLE public.chat_conversations ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_conversations' AND column_name = 'message_count') THEN
    ALTER TABLE public.chat_conversations ADD COLUMN message_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(messages)) STORED;
  END IF;
END $$;

-- ============================================================================
-- PART 2: CHAT ANALYTICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL,
  deal_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  response_text TEXT,
  response_time_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add ALL missing columns for chat_analytics
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'query_intent') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN query_intent TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'query_complexity') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN query_complexity TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'model_used') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN model_used TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'tokens_input') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN tokens_input INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'tokens_output') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN tokens_output INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'tokens_total') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN tokens_total INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'tools_called') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN tools_called JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'tool_execution_time_ms') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN tool_execution_time_ms INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'mentioned_buyer_ids') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN mentioned_buyer_ids UUID[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'mentioned_deal_ids') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN mentioned_deal_ids UUID[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'user_continued') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN user_continued BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'user_rating') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN user_rating INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'feedback_provided') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN feedback_provided BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_analytics' AND column_name = 'session_id') THEN
    ALTER TABLE public.chat_analytics ADD COLUMN session_id TEXT;
  END IF;
END $$;

-- Add constraints for chat_analytics
DO $$
BEGIN
  -- Add check constraint for context_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_analytics_context_type_check'
  ) THEN
    ALTER TABLE public.chat_analytics ADD CONSTRAINT chat_analytics_context_type_check
      CHECK (context_type IN ('deal', 'deals', 'buyers', 'universe'));
  END IF;

  -- Add check constraint for query_complexity if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_analytics_query_complexity_check'
  ) THEN
    ALTER TABLE public.chat_analytics ADD CONSTRAINT chat_analytics_query_complexity_check
      CHECK (query_complexity IN ('simple', 'medium', 'complex'));
  END IF;

  -- Add check constraint for user_rating if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_analytics_user_rating_check'
  ) THEN
    ALTER TABLE public.chat_analytics ADD CONSTRAINT chat_analytics_user_rating_check
      CHECK (user_rating IN (-1, 0, 1));
  END IF;
END $$;

-- ============================================================================
-- PART 3: CHAT FEEDBACK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  analytics_id UUID REFERENCES public.chat_analytics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_index INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  feedback_text TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns for chat_feedback
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_feedback' AND column_name = 'issue_type') THEN
    ALTER TABLE public.chat_feedback ADD COLUMN issue_type TEXT;
  END IF;
END $$;

-- Add constraints for chat_feedback
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_feedback_rating_check') THEN
    ALTER TABLE public.chat_feedback ADD CONSTRAINT chat_feedback_rating_check CHECK (rating IN (1, -1));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_feedback_issue_type_check') THEN
    ALTER TABLE public.chat_feedback ADD CONSTRAINT chat_feedback_issue_type_check
      CHECK (issue_type IN ('incorrect', 'incomplete', 'hallucination', 'poor_formatting', 'missing_data', 'slow_response', 'other'));
  END IF;
END $$;

-- ============================================================================
-- PART 4: SMART SUGGESTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_smart_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type TEXT NOT NULL,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  previous_query TEXT NOT NULL,
  suggestions JSONB NOT NULL,
  suggestion_reasoning TEXT,
  times_shown INTEGER DEFAULT 0,
  times_clicked INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_shown_at TIMESTAMPTZ
);

-- Add missing columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_smart_suggestions' AND column_name = 'click_through_rate') THEN
    ALTER TABLE public.chat_smart_suggestions ADD COLUMN click_through_rate NUMERIC GENERATED ALWAYS AS (
      CASE WHEN times_shown > 0 THEN (times_clicked::NUMERIC / times_shown::NUMERIC) ELSE 0 END
    ) STORED;
  END IF;
END $$;

-- Add constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_smart_suggestions_context_type_check') THEN
    ALTER TABLE public.chat_smart_suggestions ADD CONSTRAINT chat_smart_suggestions_context_type_check
      CHECK (context_type IN ('deal', 'deals', 'buyers', 'universe'));
  END IF;
END $$;

-- ============================================================================
-- PART 5: PROACTIVE RECOMMENDATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL,
  recommendation_text TEXT NOT NULL,
  recommendation_data JSONB,
  shown BOOLEAN DEFAULT FALSE,
  shown_at TIMESTAMPTZ,
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Add constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_recommendations_recommendation_type_check') THEN
    ALTER TABLE public.chat_recommendations ADD CONSTRAINT chat_recommendations_recommendation_type_check
      CHECK (recommendation_type IN ('explore_geography', 'explore_size', 'explore_services', 'review_transcripts', 'contact_buyers', 'expand_search', 'other'));
  END IF;
END $$;

-- ============================================================================
-- PART 6: INDEXES (created after all columns exist)
-- ============================================================================

-- chat_conversations indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations(user_id) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_deal_id ON public.chat_conversations(deal_id) WHERE deal_id IS NOT NULL AND archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_universe_id ON public.chat_conversations(universe_id) WHERE universe_id IS NOT NULL AND archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON public.chat_conversations(updated_at DESC) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_context_type ON public.chat_conversations(context_type) WHERE archived = FALSE;

-- chat_analytics indexes
CREATE INDEX IF NOT EXISTS idx_chat_analytics_user_created ON public.chat_analytics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_conversation ON public.chat_analytics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_context ON public.chat_analytics(context_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_universe ON public.chat_analytics(universe_id) WHERE universe_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_analytics_deal ON public.chat_analytics(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_analytics_intent ON public.chat_analytics(query_intent) WHERE query_intent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_analytics_tools ON public.chat_analytics USING GIN (tools_called) WHERE tools_called IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_analytics_rating ON public.chat_analytics(user_rating) WHERE user_rating IS NOT NULL;

-- chat_feedback indexes
CREATE INDEX IF NOT EXISTS idx_chat_feedback_conversation ON public.chat_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_user_created ON public.chat_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_rating ON public.chat_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_issue_type ON public.chat_feedback(issue_type) WHERE issue_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_feedback_unresolved ON public.chat_feedback(created_at DESC) WHERE resolved = FALSE;

-- chat_smart_suggestions indexes
CREATE INDEX IF NOT EXISTS idx_smart_suggestions_context ON public.chat_smart_suggestions(context_type, universe_id, deal_id) WHERE created_at > NOW() - INTERVAL '7 days';
CREATE INDEX IF NOT EXISTS idx_smart_suggestions_performance ON public.chat_smart_suggestions(click_through_rate DESC) WHERE times_shown > 10;

-- chat_recommendations indexes
CREATE INDEX IF NOT EXISTS idx_chat_recommendations_user ON public.chat_recommendations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_recommendations_conversation ON public.chat_recommendations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_recommendations_active ON public.chat_recommendations(created_at DESC) WHERE shown = FALSE AND (expires_at IS NULL OR expires_at > NOW());
CREATE INDEX IF NOT EXISTS idx_chat_recommendations_type ON public.chat_recommendations(recommendation_type);

-- ============================================================================
-- PART 7: TRIGGERS
-- ============================================================================

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

-- ============================================================================
-- PART 8: RLS POLICIES
-- ============================================================================

-- chat_conversations RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;
CREATE POLICY "Users can view own conversations" ON public.chat_conversations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own conversations" ON public.chat_conversations;
CREATE POLICY "Users can create own conversations" ON public.chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own conversations" ON public.chat_conversations;
CREATE POLICY "Users can update own conversations" ON public.chat_conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.chat_conversations;
CREATE POLICY "Users can delete own conversations" ON public.chat_conversations FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins have full access" ON public.chat_conversations;
CREATE POLICY "Admins have full access" ON public.chat_conversations FOR ALL USING (is_admin(auth.uid()));

-- chat_analytics RLS
ALTER TABLE public.chat_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own analytics" ON public.chat_analytics;
CREATE POLICY "Users can view own analytics" ON public.chat_analytics FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own analytics" ON public.chat_analytics;
CREATE POLICY "Users can insert own analytics" ON public.chat_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins have full access to analytics" ON public.chat_analytics;
CREATE POLICY "Admins have full access to analytics" ON public.chat_analytics FOR ALL USING (is_admin(auth.uid()));

-- chat_feedback RLS
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own feedback" ON public.chat_feedback;
CREATE POLICY "Users can view own feedback" ON public.chat_feedback FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.chat_feedback;
CREATE POLICY "Users can insert own feedback" ON public.chat_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own feedback" ON public.chat_feedback;
CREATE POLICY "Users can update own feedback" ON public.chat_feedback FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins have full access to feedback" ON public.chat_feedback;
CREATE POLICY "Admins have full access to feedback" ON public.chat_feedback FOR ALL USING (is_admin(auth.uid()));

-- chat_smart_suggestions RLS
ALTER TABLE public.chat_smart_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view smart suggestions" ON public.chat_smart_suggestions;
CREATE POLICY "Anyone can view smart suggestions" ON public.chat_smart_suggestions FOR SELECT USING (true);
DROP POLICY IF EXISTS "System can insert smart suggestions" ON public.chat_smart_suggestions;
CREATE POLICY "System can insert smart suggestions" ON public.chat_smart_suggestions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "System can update smart suggestions" ON public.chat_smart_suggestions;
CREATE POLICY "System can update smart suggestions" ON public.chat_smart_suggestions FOR UPDATE USING (true);

-- chat_recommendations RLS
ALTER TABLE public.chat_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own recommendations" ON public.chat_recommendations;
CREATE POLICY "Users can view own recommendations" ON public.chat_recommendations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own recommendations" ON public.chat_recommendations;
CREATE POLICY "Users can update own recommendations" ON public.chat_recommendations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "System can insert recommendations" ON public.chat_recommendations;
CREATE POLICY "System can insert recommendations" ON public.chat_recommendations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins have full access to recommendations" ON public.chat_recommendations;
CREATE POLICY "Admins have full access to recommendations" ON public.chat_recommendations FOR ALL USING (is_admin(auth.uid()));

-- ============================================================================
-- PART 9: HELPER FUNCTIONS
-- ============================================================================

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
    conversation_id, user_id, context_type, deal_id, universe_id,
    query_text, response_text, response_time_ms,
    tokens_input, tokens_output, tokens_total, tools_called
  ) VALUES (
    p_conversation_id, auth.uid(), p_context_type, p_deal_id, p_universe_id,
    p_query_text, p_response_text, p_response_time_ms,
    p_tokens_input, p_tokens_output, p_tokens_input + p_tokens_output, p_tools_called
  )
  RETURNING id INTO v_analytics_id;
  RETURN v_analytics_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 10: COMMENTS
-- ============================================================================

COMMENT ON TABLE public.chat_analytics IS 'Tracks chatbot usage, performance, and query patterns';
COMMENT ON TABLE public.chat_feedback IS 'User feedback on chatbot responses (thumbs up/down and detailed feedback)';
COMMENT ON TABLE public.chat_smart_suggestions IS 'Caches smart follow-up suggestions with performance tracking';
COMMENT ON TABLE public.chat_recommendations IS 'Proactive recommendations shown to users based on conversation analysis';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Migration complete! All 5 tables created/updated.' AS status;
