-- ============================================================================
-- BUYER FIT SCORE SYSTEM
--
-- Adds buyer quality scoring columns to profiles, connection_requests,
-- and remarketing_buyers tables. This is a marketplace buyer credibility
-- scoring system (separate from the remarketing buyer-deal fit scoring).
--
-- Score range: 0-100, four tiers:
--   Tier 1 (70-100): Platform + Add-On buyers
--   Tier 2 (45-69):  Committed Capital buyers
--   Tier 3 (15-44):  Independent Sponsor / Search Fund
--   Tier 4 (0-14):   Unverified / Incomplete
-- ============================================================================


-- ============================================================================
-- PHASE 1: ADD COLUMNS TO profiles TABLE
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buyer_fit_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_fit_tier INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_signal_detected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_signal_source TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_fit_score_last_calculated TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_tier_override INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_override_note TEXT DEFAULT NULL;

-- Add CHECK constraints
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_buyer_fit_score CHECK (buyer_fit_score IS NULL OR (buyer_fit_score >= 0 AND buyer_fit_score <= 100)),
  ADD CONSTRAINT chk_buyer_fit_tier CHECK (buyer_fit_tier IS NULL OR buyer_fit_tier IN (1, 2, 3, 4)),
  ADD CONSTRAINT chk_admin_tier_override CHECK (admin_tier_override IS NULL OR admin_tier_override IN (1, 2, 3, 4)),
  ADD CONSTRAINT chk_platform_signal_source CHECK (platform_signal_source IS NULL OR platform_signal_source IN ('message', 'profile', 'enrichment'));


-- ============================================================================
-- PHASE 2: ADD COLUMNS TO connection_requests TABLE
-- ============================================================================

ALTER TABLE public.connection_requests
  ADD COLUMN IF NOT EXISTS deal_specific_buyer_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deal_specific_buyer_tier INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deal_specific_platform_signal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_specific_platform_keywords TEXT[] DEFAULT NULL;

ALTER TABLE public.connection_requests
  ADD CONSTRAINT chk_deal_specific_buyer_score CHECK (deal_specific_buyer_score IS NULL OR (deal_specific_buyer_score >= 0 AND deal_specific_buyer_score <= 100)),
  ADD CONSTRAINT chk_deal_specific_buyer_tier CHECK (deal_specific_buyer_tier IS NULL OR deal_specific_buyer_tier IN (1, 2, 3, 4));


-- ============================================================================
-- PHASE 3: ADD COLUMNS TO remarketing_buyers TABLE
-- ============================================================================

ALTER TABLE public.remarketing_buyers
  ADD COLUMN IF NOT EXISTS buyer_fit_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_fit_tier INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_signal_detected BOOLEAN DEFAULT false;


-- ============================================================================
-- PHASE 4: ADD INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_buyer_fit_tier
  ON public.profiles (buyer_fit_tier);

CREATE INDEX IF NOT EXISTS idx_profiles_buyer_fit_score
  ON public.profiles (buyer_fit_score DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_platform_signal
  ON public.profiles (platform_signal_detected)
  WHERE platform_signal_detected = true;

CREATE INDEX IF NOT EXISTS idx_connection_requests_deal_specific_buyer_tier
  ON public.connection_requests (deal_specific_buyer_tier);


-- ============================================================================
-- PHASE 5: COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.profiles.buyer_fit_score IS 'Marketplace buyer quality score (0-100). Calculated by calculate-buyer-fit-score edge function.';
COMMENT ON COLUMN public.profiles.buyer_fit_tier IS 'Buyer quality tier (1-4). 1=Platform+AddOn, 2=CommittedCapital, 3=IndepSponsor/SearchFund, 4=Unverified.';
COMMENT ON COLUMN public.profiles.platform_signal_detected IS 'Whether platform/add-on acquisition intent was detected in profile or messages.';
COMMENT ON COLUMN public.profiles.platform_signal_source IS 'Where platform signal was detected: message, profile, or enrichment.';
COMMENT ON COLUMN public.profiles.buyer_fit_score_last_calculated IS 'Timestamp of last buyer fit score calculation.';
COMMENT ON COLUMN public.profiles.admin_tier_override IS 'Manual admin override for buyer tier. Overrides algorithmic tier when set.';
COMMENT ON COLUMN public.profiles.admin_override_note IS 'Admin note explaining why tier was manually overridden.';

COMMENT ON COLUMN public.connection_requests.deal_specific_buyer_score IS 'Deal-specific buyer fit score, may differ from profile score when message reveals platform intent.';
COMMENT ON COLUMN public.connection_requests.deal_specific_buyer_tier IS 'Deal-specific buyer tier derived from deal_specific_buyer_score.';
COMMENT ON COLUMN public.connection_requests.deal_specific_platform_signal IS 'Whether platform/add-on signal was detected in this specific deal request message.';
COMMENT ON COLUMN public.connection_requests.deal_specific_platform_keywords IS 'Keywords that triggered platform signal detection in the deal request message.';
