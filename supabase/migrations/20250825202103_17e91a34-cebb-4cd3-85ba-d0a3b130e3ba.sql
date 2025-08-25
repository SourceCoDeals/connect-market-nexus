-- Add new fields for comprehensive buyer signup forms
-- All fields are optional to maintain compatibility with existing users

-- Add job_title to step 2
ALTER TABLE public.profiles ADD COLUMN job_title TEXT;

-- Private Equity fields
ALTER TABLE public.profiles ADD COLUMN portfolio_company_addon TEXT;
ALTER TABLE public.profiles ADD COLUMN deploying_capital_now TEXT;

-- Corporate Development fields  
ALTER TABLE public.profiles ADD COLUMN owning_business_unit TEXT;
ALTER TABLE public.profiles ADD COLUMN deal_size_band TEXT;
ALTER TABLE public.profiles ADD COLUMN integration_plan JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN corpdev_intent TEXT;

-- Family Office fields
ALTER TABLE public.profiles ADD COLUMN discretion_type TEXT;
ALTER TABLE public.profiles ADD COLUMN permanent_capital BOOLEAN;
ALTER TABLE public.profiles ADD COLUMN operating_company_targets JSONB DEFAULT '[]'::jsonb;

-- Independent Sponsor fields
ALTER TABLE public.profiles ADD COLUMN committed_equity_band TEXT;
ALTER TABLE public.profiles ADD COLUMN equity_source JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN flex_subxm_ebitda BOOLEAN;
ALTER TABLE public.profiles ADD COLUMN backers_summary TEXT;
ALTER TABLE public.profiles ADD COLUMN deployment_timing TEXT;

-- Search Fund fields
ALTER TABLE public.profiles ADD COLUMN search_type TEXT;
ALTER TABLE public.profiles ADD COLUMN acq_equity_band TEXT;
ALTER TABLE public.profiles ADD COLUMN financing_plan JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN flex_sub2m_ebitda BOOLEAN;
ALTER TABLE public.profiles ADD COLUMN anchor_investors_summary TEXT;
ALTER TABLE public.profiles ADD COLUMN search_stage TEXT;

-- Advisor/Banker fields
ALTER TABLE public.profiles ADD COLUMN on_behalf_of_buyer TEXT;
ALTER TABLE public.profiles ADD COLUMN buyer_role TEXT;
ALTER TABLE public.profiles ADD COLUMN buyer_org_url TEXT;
ALTER TABLE public.profiles ADD COLUMN mandate_blurb TEXT;

-- Business Owner fields
ALTER TABLE public.profiles ADD COLUMN owner_intent TEXT;
ALTER TABLE public.profiles ADD COLUMN owner_timeline TEXT;

-- Individual Investor fields
ALTER TABLE public.profiles ADD COLUMN funding_source TEXT;
ALTER TABLE public.profiles ADD COLUMN uses_bank_finance TEXT;
ALTER TABLE public.profiles ADD COLUMN max_equity_today_band TEXT;