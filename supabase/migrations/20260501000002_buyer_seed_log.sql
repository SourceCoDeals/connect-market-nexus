-- Migration C: buyer_seed_log table
-- Audit trail for the AI buyer seeding engine.

CREATE TABLE IF NOT EXISTS public.buyer_seed_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remarketing_buyer_id  UUID NOT NULL REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  source_deal_id        UUID,
  why_relevant          TEXT,
  known_acquisitions    TEXT[],
  was_new_record        BOOLEAN DEFAULT true,
  action                TEXT, -- 'inserted' | 'enriched_existing' | 'probable_duplicate'
  seeded_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  seed_model            TEXT DEFAULT 'claude-sonnet-4-20250514',
  category_cache_key    TEXT
);

ALTER TABLE public.buyer_seed_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.buyer_seed_log
  FOR ALL USING (public.is_admin_or_moderator());
