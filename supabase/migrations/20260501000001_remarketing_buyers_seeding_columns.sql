-- Migration B: remarketing_buyers seeding columns
-- Adds columns needed to track AI-seeded buyers.

ALTER TABLE public.remarketing_buyers
  ADD COLUMN IF NOT EXISTS ai_seeded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_seeded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ai_seeded_from_deal_id UUID,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_buyers_ai_seeded
  ON public.remarketing_buyers(ai_seeded) WHERE ai_seeded = true;

CREATE INDEX IF NOT EXISTS idx_buyers_verification
  ON public.remarketing_buyers(verification_status) WHERE ai_seeded = true;
