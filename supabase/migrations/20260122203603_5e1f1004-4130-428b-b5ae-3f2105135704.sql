-- Phase 1: Add missing columns to remarketing tables

-- 1.1 Add missing columns to remarketing_buyers
ALTER TABLE public.remarketing_buyers 
ADD COLUMN IF NOT EXISTS pe_firm_name TEXT,
ADD COLUMN IF NOT EXISTS platform_website TEXT,
ADD COLUMN IF NOT EXISTS num_platforms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hq_city TEXT,
ADD COLUMN IF NOT EXISTS hq_state TEXT,
ADD COLUMN IF NOT EXISTS hq_country TEXT DEFAULT 'United States',
ADD COLUMN IF NOT EXISTS hq_region TEXT,
ADD COLUMN IF NOT EXISTS service_regions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pe_firm_website TEXT,
ADD COLUMN IF NOT EXISTS buyer_linkedin TEXT,
ADD COLUMN IF NOT EXISTS pe_firm_linkedin TEXT,
ADD COLUMN IF NOT EXISTS operating_locations TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS has_fee_agreement BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS business_summary TEXT,
ADD COLUMN IF NOT EXISTS industry_vertical TEXT,
ADD COLUMN IF NOT EXISTS specialized_focus TEXT,
ADD COLUMN IF NOT EXISTS acquisition_appetite TEXT,
ADD COLUMN IF NOT EXISTS strategic_priorities TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS total_acquisitions INTEGER,
ADD COLUMN IF NOT EXISTS acquisition_frequency TEXT;

-- 1.2 Add missing columns to remarketing_buyer_contacts
ALTER TABLE public.remarketing_buyer_contacts 
ADD COLUMN IF NOT EXISTS company_type TEXT,
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS email_confidence TEXT,
ADD COLUMN IF NOT EXISTS salesforce_id TEXT,
ADD COLUMN IF NOT EXISTS is_deal_team BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS role_category TEXT,
ADD COLUMN IF NOT EXISTS is_primary_contact BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS source_url TEXT;

-- 1.3 Add missing columns to remarketing_scores
ALTER TABLE public.remarketing_scores 
ADD COLUMN IF NOT EXISTS acquisition_score NUMERIC,
ADD COLUMN IF NOT EXISTS portfolio_score NUMERIC,
ADD COLUMN IF NOT EXISTS business_model_score NUMERIC,
ADD COLUMN IF NOT EXISTS thesis_bonus NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS hidden_from_deal BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rejection_category TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejection_notes TEXT,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- 1.4 Add missing columns to remarketing_buyer_universes
ALTER TABLE public.remarketing_buyer_universes 
ADD COLUMN IF NOT EXISTS kpi_scoring_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS industry_template TEXT;

-- 1.5 Add missing columns to deal_transcripts
ALTER TABLE public.deal_transcripts 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 1.6 Add missing columns to industry_trackers
ALTER TABLE public.industry_trackers 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();