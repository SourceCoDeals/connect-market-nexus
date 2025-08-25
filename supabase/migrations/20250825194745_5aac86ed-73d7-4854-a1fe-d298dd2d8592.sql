-- Add new buyer types and comprehensive signup fields

-- Add new optional fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS job_title text,

-- Private Equity fields
ADD COLUMN IF NOT EXISTS portfolio_company_addon text,
ADD COLUMN IF NOT EXISTS deploying_capital_now text,

-- Corporate Development fields  
ADD COLUMN IF NOT EXISTS owning_business_unit text,
ADD COLUMN IF NOT EXISTS deal_size_band text,
ADD COLUMN IF NOT EXISTS integration_plan jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS corpdev_intent text,

-- Family Office fields
ADD COLUMN IF NOT EXISTS discretion_type text,
ADD COLUMN IF NOT EXISTS permanent_capital boolean,
ADD COLUMN IF NOT EXISTS operating_company_targets jsonb DEFAULT '[]'::jsonb,

-- Independent Sponsor fields
ADD COLUMN IF NOT EXISTS committed_equity_band text,
ADD COLUMN IF NOT EXISTS equity_source jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS flex_subXm_ebitda boolean,
ADD COLUMN IF NOT EXISTS backers_summary text,
ADD COLUMN IF NOT EXISTS deployment_timing text,

-- Search Fund fields (redesigned)
ADD COLUMN IF NOT EXISTS search_type text,
ADD COLUMN IF NOT EXISTS acq_equity_band text,
ADD COLUMN IF NOT EXISTS financing_plan jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS flex_sub2m_ebitda boolean,
ADD COLUMN IF NOT EXISTS anchor_investors_summary text,
ADD COLUMN IF NOT EXISTS search_stage text,

-- Advisor/Banker fields
ADD COLUMN IF NOT EXISTS on_behalf_of_buyer text,
ADD COLUMN IF NOT EXISTS buyer_role text,
ADD COLUMN IF NOT EXISTS buyer_org_url text,
ADD COLUMN IF NOT EXISTS mandate_blurb text,

-- Business Owner fields
ADD COLUMN IF NOT EXISTS owner_intent text,
ADD COLUMN IF NOT EXISTS owner_timeline text,

-- Individual Investor fields (enhanced)
ADD COLUMN IF NOT EXISTS max_equity_today_band text,
ADD COLUMN IF NOT EXISTS uses_bank_finance text;