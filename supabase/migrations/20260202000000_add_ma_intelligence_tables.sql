-- M&A Intelligence Module Tables
-- This migration adds the core tables needed for the M&A Intelligence module
-- NOTE: This does NOT modify any existing tables (deals, industry_trackers are already present)

-- ============================================================
-- BUYERS TABLE (core M&A buyer entity)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.buyers (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tracker_id uuid NOT NULL REFERENCES public.industry_trackers(id) ON DELETE CASCADE,
    pe_firm_name text NOT NULL,
    platform_company_name text,
    platform_website text,
    num_platforms integer,
    geographic_footprint text[],
    recent_acquisitions jsonb DEFAULT '[]'::jsonb,
    portfolio_companies text[],
    services_offered text,
    business_model text,
    thesis_summary text,
    geo_preferences jsonb DEFAULT '{}'::jsonb,
    min_revenue numeric,
    max_revenue numeric,
    preferred_ebitda numeric,
    service_mix_prefs text,
    business_model_prefs text,
    deal_breakers text[],
    addon_only boolean DEFAULT false,
    platform_only boolean DEFAULT false,
    thesis_confidence text CHECK (thesis_confidence IN ('High', 'Medium', 'Low')),
    last_call_date date,
    call_history jsonb DEFAULT '[]'::jsonb,
    key_quotes text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    data_last_updated timestamp with time zone DEFAULT now() NOT NULL,
    hq_city text,
    hq_state text,
    service_regions text[],
    fee_agreement_status text DEFAULT 'None'::text,
    pe_firm_website text,
    buyer_linkedin text,
    pe_firm_linkedin text,
    hq_country text DEFAULT 'USA'::text,
    hq_region text,
    other_office_locations text[],
    acquisition_geography text[],
    target_geographies text[],
    geographic_exclusions text[],
    industry_vertical text,
    business_summary text,
    specialized_focus text,
    primary_customer_size text,
    customer_industries text[],
    customer_geographic_reach text,
    target_customer_profile text,
    target_customer_size text,
    target_customer_industries text[],
    target_customer_geography text,
    business_type text,
    revenue_model text,
    go_to_market_strategy text,
    target_business_model text,
    business_model_exclusions text[],
    min_ebitda numeric,
    max_ebitda numeric,
    revenue_sweet_spot numeric,
    ebitda_sweet_spot numeric,
    total_acquisitions integer,
    acquisition_frequency text,
    last_acquisition_date date,
    target_services text[],
    required_capabilities text[],
    target_industries text[],
    industry_exclusions text[],
    strategic_priorities text,
    acquisition_appetite text,
    acquisition_timeline text,
    owner_roll_requirement text,
    owner_transition_goals text,
    employee_owner text,
    extraction_evidence jsonb DEFAULT '{}'::jsonb,
    extraction_sources jsonb DEFAULT '[]'::jsonb,
    operating_locations jsonb DEFAULT '[]'::jsonb,
    has_fee_agreement boolean DEFAULT false
);

-- ============================================================
-- BUYER DEAL SCORES TABLE (M&A buyer-deal matching scores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.buyer_deal_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    buyer_id uuid NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
    deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    scored_at timestamp with time zone DEFAULT now() NOT NULL,
    geography_score integer CHECK (geography_score >= 0 AND geography_score <= 100),
    service_score integer CHECK (service_score >= 0 AND service_score <= 100),
    acquisition_score integer CHECK (acquisition_score >= 0 AND acquisition_score <= 100),
    portfolio_score integer CHECK (portfolio_score >= 0 AND portfolio_score <= 100),
    business_model_score integer CHECK (business_model_score >= 0 AND business_model_score <= 100),
    thesis_bonus integer DEFAULT 0 CHECK (thesis_bonus >= 0 AND thesis_bonus <= 50),
    composite_score numeric,
    fit_reasoning text,
    data_completeness text CHECK (data_completeness IN ('High', 'Medium', 'Low')),
    selected_for_outreach boolean DEFAULT false,
    human_override_score numeric,
    passed_on_deal boolean DEFAULT false,
    pass_reason text,
    pass_category text,
    passed_at timestamp with time zone,
    pass_notes text,
    interested boolean,
    interested_at timestamp with time zone,
    hidden_from_deal boolean DEFAULT false,
    rejection_category text,
    rejection_reason text,
    rejection_notes text,
    rejected_at timestamp with time zone,
    CONSTRAINT buyer_deal_scores_unique UNIQUE (buyer_id, deal_id)
);

-- ============================================================
-- BUYER CONTACTS TABLE (contacts for M&A buyers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.buyer_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    buyer_id uuid NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
    name text NOT NULL,
    title text,
    company_type text,
    priority_level integer CHECK (priority_level >= 1 AND priority_level <= 4),
    linkedin_url text,
    email text,
    phone text,
    email_confidence text CHECK (email_confidence IN ('Verified', 'Likely', 'Guessed')),
    salesforce_id text,
    last_contacted_date date,
    fee_agreement_status text DEFAULT 'None'::text CHECK (fee_agreement_status IN ('Active', 'Expired', 'None')),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'manual'::text,
    source_url text,
    is_deal_team boolean DEFAULT false,
    role_category text,
    is_primary_contact boolean DEFAULT false
);

-- ============================================================
-- BUYER LEARNING HISTORY TABLE (feedback for ML improvements)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.buyer_learning_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    buyer_id uuid NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
    deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    action_type text DEFAULT 'not_a_fit'::text NOT NULL,
    rejection_categories text[],
    rejection_reason text,
    rejection_notes text,
    deal_context jsonb,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);

-- ============================================================
-- DEAL SCORING ADJUSTMENTS TABLE (per-deal scoring weights)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deal_scoring_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
    geography_weight_mult numeric DEFAULT 1.0,
    size_weight_mult numeric DEFAULT 1.0,
    services_weight_mult numeric DEFAULT 1.0,
    approved_count integer DEFAULT 0,
    rejected_count integer DEFAULT 0,
    passed_geography integer DEFAULT 0,
    passed_size integer DEFAULT 0,
    passed_services integer DEFAULT 0,
    last_calculated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    custom_instructions text,
    parsed_instructions jsonb
);

-- ============================================================
-- CALL INTELLIGENCE TABLE (extracted call/transcript data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.call_intelligence (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
    buyer_id uuid REFERENCES public.buyers(id) ON DELETE CASCADE,
    call_type text DEFAULT 'discovery'::text NOT NULL,
    transcript_url text,
    call_date date,
    extracted_data jsonb DEFAULT '{}'::jsonb,
    call_summary text,
    key_takeaways text[],
    follow_up_questions text[],
    extraction_version text,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT call_intelligence_entity_check CHECK ((deal_id IS NOT NULL) OR (buyer_id IS NOT NULL))
);

-- ============================================================
-- DEAL TRANSCRIPTS TABLE (transcripts linked to deals)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deal_transcripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    title text NOT NULL,
    transcript_type text DEFAULT 'link'::text NOT NULL,
    url text,
    notes text,
    call_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    extracted_data jsonb DEFAULT '{}'::jsonb,
    extraction_evidence jsonb DEFAULT '{}'::jsonb,
    processed_at timestamp with time zone
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_buyers_tracker_id ON public.buyers(tracker_id);
CREATE INDEX IF NOT EXISTS idx_buyers_pe_firm_name ON public.buyers(pe_firm_name);
CREATE INDEX IF NOT EXISTS idx_buyer_deal_scores_buyer_id ON public.buyer_deal_scores(buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_deal_scores_deal_id ON public.buyer_deal_scores(deal_id);
CREATE INDEX IF NOT EXISTS idx_buyer_deal_scores_composite ON public.buyer_deal_scores(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_contacts_buyer_id ON public.buyer_contacts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_deal_scoring_adjustments_deal_id ON public.deal_scoring_adjustments(deal_id);
CREATE INDEX IF NOT EXISTS idx_call_intelligence_deal_id ON public.call_intelligence(deal_id);
CREATE INDEX IF NOT EXISTS idx_call_intelligence_buyer_id ON public.call_intelligence(buyer_id);
CREATE INDEX IF NOT EXISTS idx_deal_transcripts_deal_id ON public.deal_transcripts(deal_id);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_deal_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_learning_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_scoring_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_transcripts ENABLE ROW LEVEL SECURITY;

-- Buyers policies (authenticated users can view and manage)
CREATE POLICY "Users can view buyers" ON public.buyers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert buyers" ON public.buyers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update buyers" ON public.buyers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete buyers" ON public.buyers FOR DELETE TO authenticated USING (true);

-- Buyer deal scores policies
CREATE POLICY "Users can view buyer_deal_scores" ON public.buyer_deal_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert buyer_deal_scores" ON public.buyer_deal_scores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update buyer_deal_scores" ON public.buyer_deal_scores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete buyer_deal_scores" ON public.buyer_deal_scores FOR DELETE TO authenticated USING (true);

-- Buyer contacts policies
CREATE POLICY "Users can view buyer_contacts" ON public.buyer_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert buyer_contacts" ON public.buyer_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update buyer_contacts" ON public.buyer_contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete buyer_contacts" ON public.buyer_contacts FOR DELETE TO authenticated USING (true);

-- Buyer learning history policies
CREATE POLICY "Users can view buyer_learning_history" ON public.buyer_learning_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert buyer_learning_history" ON public.buyer_learning_history FOR INSERT TO authenticated WITH CHECK (true);

-- Deal scoring adjustments policies
CREATE POLICY "Users can view deal_scoring_adjustments" ON public.deal_scoring_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert deal_scoring_adjustments" ON public.deal_scoring_adjustments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update deal_scoring_adjustments" ON public.deal_scoring_adjustments FOR UPDATE TO authenticated USING (true);

-- Call intelligence policies
CREATE POLICY "Users can view call_intelligence" ON public.call_intelligence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert call_intelligence" ON public.call_intelligence FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update call_intelligence" ON public.call_intelligence FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete call_intelligence" ON public.call_intelligence FOR DELETE TO authenticated USING (true);

-- Deal transcripts policies
CREATE POLICY "Users can view deal_transcripts" ON public.deal_transcripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert deal_transcripts" ON public.deal_transcripts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update deal_transcripts" ON public.deal_transcripts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete deal_transcripts" ON public.deal_transcripts FOR DELETE TO authenticated USING (true);

-- ============================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================

-- Add deal_score column to deals table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'deal_score') THEN
        ALTER TABLE public.deals ADD COLUMN deal_score integer;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'last_enriched_at') THEN
        ALTER TABLE public.deals ADD COLUMN last_enriched_at timestamp with time zone;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'extraction_sources') THEN
        ALTER TABLE public.deals ADD COLUMN extraction_sources jsonb DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'industry_kpis') THEN
        ALTER TABLE public.deals ADD COLUMN industry_kpis jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'company_address') THEN
        ALTER TABLE public.deals ADD COLUMN company_address text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'contact_title') THEN
        ALTER TABLE public.deals ADD COLUMN contact_title text;
    END IF;
END $$;

-- Add scoring criteria columns to industry_trackers table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_trackers' AND column_name = 'size_criteria') THEN
        ALTER TABLE public.industry_trackers ADD COLUMN size_criteria jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_trackers' AND column_name = 'service_criteria') THEN
        ALTER TABLE public.industry_trackers ADD COLUMN service_criteria jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_trackers' AND column_name = 'geography_criteria') THEN
        ALTER TABLE public.industry_trackers ADD COLUMN geography_criteria jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_trackers' AND column_name = 'buyer_types_criteria') THEN
        ALTER TABLE public.industry_trackers ADD COLUMN buyer_types_criteria jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_trackers' AND column_name = 'kpi_scoring_config') THEN
        ALTER TABLE public.industry_trackers ADD COLUMN kpi_scoring_config jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_trackers' AND column_name = 'geography_weight') THEN
        ALTER TABLE public.industry_trackers ADD COLUMN geography_weight numeric DEFAULT 1.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_trackers' AND column_name = 'service_mix_weight') THEN
        ALTER TABLE public.industry_trackers ADD COLUMN service_mix_weight numeric DEFAULT 1.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_trackers' AND column_name = 'size_weight') THEN
        ALTER TABLE public.industry_trackers ADD COLUMN size_weight numeric DEFAULT 1.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_trackers' AND column_name = 'owner_goals_weight') THEN
        ALTER TABLE public.industry_trackers ADD COLUMN owner_goals_weight numeric DEFAULT 1.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_trackers' AND column_name = 'archived') THEN
        ALTER TABLE public.industry_trackers ADD COLUMN archived boolean DEFAULT false;
    END IF;
END $$;

-- ============================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables with that column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_deal_scoring_adjustments_updated_at') THEN
        CREATE TRIGGER update_deal_scoring_adjustments_updated_at
        BEFORE UPDATE ON public.deal_scoring_adjustments
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_call_intelligence_updated_at') THEN
        CREATE TRIGGER update_call_intelligence_updated_at
        BEFORE UPDATE ON public.call_intelligence
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
