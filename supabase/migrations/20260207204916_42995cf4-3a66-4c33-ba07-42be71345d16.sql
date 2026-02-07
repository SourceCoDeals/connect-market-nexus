
-- Add missing columns to chat_conversations
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS context_type text DEFAULT 'deal',
  ADD COLUMN IF NOT EXISTS deal_id uuid,
  ADD COLUMN IF NOT EXISTS universe_id uuid,
  ADD COLUMN IF NOT EXISTS title text DEFAULT 'New Conversation',
  ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- Create chat_analytics table
CREATE TABLE IF NOT EXISTS public.chat_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id text,
  context_type text,
  deal_id uuid,
  universe_id uuid,
  query_text text NOT NULL,
  response_text text,
  response_time_ms integer DEFAULT 0,
  tokens_input integer DEFAULT 0,
  tokens_output integer DEFAULT 0,
  tokens_total integer DEFAULT 0,
  tools_called text,
  user_continued boolean DEFAULT false,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analytics"
  ON public.chat_analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics"
  ON public.chat_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics"
  ON public.chat_analytics FOR UPDATE
  USING (auth.uid() = user_id);

-- Create chat_feedback table
CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id text NOT NULL,
  message_index integer NOT NULL,
  rating integer NOT NULL,
  issue_type text,
  feedback_text text,
  resolved boolean DEFAULT false,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
  ON public.chat_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON public.chat_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create chat_smart_suggestions table
CREATE TABLE IF NOT EXISTS public.chat_smart_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id text,
  suggestion_text text NOT NULL,
  intent text,
  was_selected boolean DEFAULT false,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_smart_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suggestions"
  ON public.chat_smart_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suggestions"
  ON public.chat_smart_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
  ON public.chat_smart_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

-- Create chat_recommendations table
CREATE TABLE IF NOT EXISTS public.chat_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id text,
  recommendation_type text NOT NULL,
  title text NOT NULL,
  message text,
  action_text text,
  action_query text,
  priority text DEFAULT 'medium',
  was_accepted boolean DEFAULT false,
  was_dismissed boolean DEFAULT false,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recommendations"
  ON public.chat_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recommendations"
  ON public.chat_recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations"
  ON public.chat_recommendations FOR UPDATE
  USING (auth.uid() = user_id);
