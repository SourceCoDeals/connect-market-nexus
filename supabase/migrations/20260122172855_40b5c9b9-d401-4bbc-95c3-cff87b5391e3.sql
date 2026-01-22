-- =============================================
-- REMARKETING TOOL TABLES
-- =============================================

-- 1. Buyer Universes (industry/criteria groupings)
CREATE TABLE public.remarketing_buyer_universes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  fit_criteria TEXT,
  size_criteria JSONB DEFAULT '{}',
  geography_criteria JSONB DEFAULT '{}',
  service_criteria JSONB DEFAULT '{}',
  buyer_types_criteria JSONB DEFAULT '{}',
  geography_weight INTEGER NOT NULL DEFAULT 35,
  size_weight INTEGER NOT NULL DEFAULT 25,
  service_weight INTEGER NOT NULL DEFAULT 25,
  owner_goals_weight INTEGER NOT NULL DEFAULT 15,
  scoring_behavior JSONB DEFAULT '{}',
  ma_guide_content TEXT,
  documents JSONB DEFAULT '[]',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. External Buyers (PE firms, platforms, strategic buyers)
CREATE TABLE public.remarketing_buyers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  company_website TEXT,
  buyer_type TEXT CHECK (buyer_type IN ('pe_firm', 'platform', 'strategic', 'family_office', 'other')),
  thesis_summary TEXT,
  thesis_confidence TEXT CHECK (thesis_confidence IN ('high', 'medium', 'low')),
  target_revenue_min NUMERIC,
  target_revenue_max NUMERIC,
  target_ebitda_min NUMERIC,
  target_ebitda_max NUMERIC,
  target_geographies TEXT[] DEFAULT '{}',
  target_services TEXT[] DEFAULT '{}',
  target_industries TEXT[] DEFAULT '{}',
  geographic_footprint TEXT[] DEFAULT '{}',
  recent_acquisitions JSONB DEFAULT '[]',
  portfolio_companies JSONB DEFAULT '[]',
  extraction_sources JSONB DEFAULT '[]',
  data_completeness TEXT CHECK (data_completeness IN ('high', 'medium', 'low')) DEFAULT 'low',
  data_last_updated TIMESTAMPTZ,
  notes TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Buyer Contacts
CREATE TABLE public.remarketing_buyer_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  linkedin_url TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Match Scores (AI-generated scores between listings and buyers)
CREATE TABLE public.remarketing_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE SET NULL,
  composite_score NUMERIC NOT NULL DEFAULT 0,
  geography_score NUMERIC DEFAULT 0,
  size_score NUMERIC DEFAULT 0,
  service_score NUMERIC DEFAULT 0,
  owner_goals_score NUMERIC DEFAULT 0,
  tier TEXT CHECK (tier IN ('A', 'B', 'C', 'D')),
  fit_reasoning TEXT,
  data_completeness TEXT CHECK (data_completeness IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'passed', 'hidden')),
  pass_reason TEXT,
  pass_category TEXT,
  human_override_score NUMERIC,
  scored_by UUID REFERENCES auth.users(id),
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(listing_id, buyer_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_remarketing_buyers_universe ON public.remarketing_buyers(universe_id);
CREATE INDEX idx_remarketing_buyers_type ON public.remarketing_buyers(buyer_type);
CREATE INDEX idx_remarketing_buyers_archived ON public.remarketing_buyers(archived);
CREATE INDEX idx_remarketing_contacts_buyer ON public.remarketing_buyer_contacts(buyer_id);
CREATE INDEX idx_remarketing_scores_listing ON public.remarketing_scores(listing_id);
CREATE INDEX idx_remarketing_scores_buyer ON public.remarketing_scores(buyer_id);
CREATE INDEX idx_remarketing_scores_status ON public.remarketing_scores(status);
CREATE INDEX idx_remarketing_scores_tier ON public.remarketing_scores(tier);
CREATE INDEX idx_remarketing_scores_composite ON public.remarketing_scores(composite_score DESC);

-- =============================================
-- ENABLE RLS
-- =============================================

ALTER TABLE public.remarketing_buyer_universes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarketing_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarketing_buyer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarketing_scores ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES (Admin-only access using is_admin(auth.uid()))
-- =============================================

-- Buyer Universes policies
CREATE POLICY "Admins can manage universes" ON public.remarketing_buyer_universes
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Buyers policies
CREATE POLICY "Admins can manage buyers" ON public.remarketing_buyers
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Buyer Contacts policies
CREATE POLICY "Admins can manage contacts" ON public.remarketing_buyer_contacts
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Scores policies
CREATE POLICY "Admins can manage scores" ON public.remarketing_scores
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

CREATE TRIGGER update_remarketing_universes_updated_at
  BEFORE UPDATE ON public.remarketing_buyer_universes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_remarketing_buyers_updated_at
  BEFORE UPDATE ON public.remarketing_buyers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_remarketing_contacts_updated_at
  BEFORE UPDATE ON public.remarketing_buyer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_remarketing_scores_updated_at
  BEFORE UPDATE ON public.remarketing_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();