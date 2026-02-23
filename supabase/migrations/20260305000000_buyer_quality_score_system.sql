-- ============================================================================
-- BUYER QUALITY SCORE SYSTEM
-- Marketplace buyer quality ranking & deal visibility engine
-- ============================================================================

-- 4.1 Add to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buyer_quality_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_tier INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_signal_detected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_signal_source TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_quality_score_last_calculated TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_tier_override INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_override_note TEXT DEFAULT NULL;

-- 4.2 Add to connection_requests table
ALTER TABLE public.connection_requests
  ADD COLUMN IF NOT EXISTS deal_specific_buyer_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deal_specific_platform_signal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_specific_platform_keywords TEXT[] DEFAULT NULL;

-- 4.4 Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_buyer_tier
  ON public.profiles(buyer_tier);

CREATE INDEX IF NOT EXISTS idx_profiles_buyer_quality_score
  ON public.profiles(buyer_quality_score DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_platform_signal
  ON public.profiles(platform_signal_detected)
  WHERE platform_signal_detected = true;

-- Composite index for deal visibility queries (tier + approval status)
CREATE INDEX IF NOT EXISTS idx_profiles_tier_approval
  ON public.profiles(buyer_tier, approval_status)
  WHERE buyer_tier IS NOT NULL;
