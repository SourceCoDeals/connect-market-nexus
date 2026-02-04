-- Create chat_conversations table for persisting chat history
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  tracker_id UUID REFERENCES public.industry_trackers(id) ON DELETE SET NULL,
  conversation_type TEXT NOT NULL DEFAULT 'deal' CHECK (conversation_type IN ('deal', 'tracker', 'criteria')),
  user_id UUID NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  message_count INTEGER NOT NULL DEFAULT 0
);

-- Create buyer_pass_decisions table to track when users pass on buyers
CREATE TABLE public.buyer_pass_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  pass_reason TEXT,
  pass_category TEXT CHECK (pass_category IN ('acquisition_timing', 'size_mismatch', 'geographic_mismatch', 'service_mismatch', 'competition', 'other', NULL)),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(listing_id, buyer_id)
);

-- Create buyer_approve_decisions table to track when users approve buyers
CREATE TABLE public.buyer_approve_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  approval_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(listing_id, buyer_id)
);

-- Enable RLS on all tables
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_pass_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_approve_decisions ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_conversations (admins only)
CREATE POLICY "Admins can view all chat conversations"
  ON public.chat_conversations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can insert chat conversations"
  ON public.chat_conversations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can update chat conversations"
  ON public.chat_conversations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can delete chat conversations"
  ON public.chat_conversations FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- RLS policies for buyer_pass_decisions (admins only)
CREATE POLICY "Admins can view all pass decisions"
  ON public.buyer_pass_decisions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can insert pass decisions"
  ON public.buyer_pass_decisions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can delete pass decisions"
  ON public.buyer_pass_decisions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- RLS policies for buyer_approve_decisions (admins only)
CREATE POLICY "Admins can view all approve decisions"
  ON public.buyer_approve_decisions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can insert approve decisions"
  ON public.buyer_approve_decisions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can delete approve decisions"
  ON public.buyer_approve_decisions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Create indexes for performance
CREATE INDEX idx_chat_conversations_listing ON public.chat_conversations(listing_id);
CREATE INDEX idx_chat_conversations_tracker ON public.chat_conversations(tracker_id);
CREATE INDEX idx_chat_conversations_user ON public.chat_conversations(user_id);
CREATE INDEX idx_buyer_pass_decisions_listing ON public.buyer_pass_decisions(listing_id);
CREATE INDEX idx_buyer_pass_decisions_buyer ON public.buyer_pass_decisions(buyer_id);
CREATE INDEX idx_buyer_approve_decisions_listing ON public.buyer_approve_decisions(listing_id);
CREATE INDEX idx_buyer_approve_decisions_buyer ON public.buyer_approve_decisions(buyer_id);

-- Trigger to update updated_at on chat_conversations
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();