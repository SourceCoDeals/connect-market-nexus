-- Add standardized investor-focused fields to listings table
ALTER TABLE public.listings 
ADD COLUMN ownership_structure TEXT,
ADD COLUMN seller_motivation TEXT,
ADD COLUMN management_depth TEXT,
ADD COLUMN revenue_model_breakdown JSONB DEFAULT '{}'::jsonb,
ADD COLUMN customer_concentration NUMERIC,
ADD COLUMN market_position JSONB DEFAULT '{}'::jsonb,
ADD COLUMN transaction_preferences JSONB DEFAULT '{}'::jsonb,
ADD COLUMN growth_drivers JSONB DEFAULT '[]'::jsonb,
ADD COLUMN key_risks JSONB DEFAULT '[]'::jsonb,
ADD COLUMN investment_thesis TEXT,
ADD COLUMN seller_involvement_preference TEXT,
ADD COLUMN timeline_preference TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.listings.ownership_structure IS 'Current ownership type: individual, family, corporate, private_equity';
COMMENT ON COLUMN public.listings.seller_motivation IS 'Reason for sale: retirement, succession, growth_capital, liquidity_event';
COMMENT ON COLUMN public.listings.management_depth IS 'Management structure: owner_operated, management_team, succession_ready';
COMMENT ON COLUMN public.listings.revenue_model_breakdown IS 'Breakdown of revenue types with percentages';
COMMENT ON COLUMN public.listings.customer_concentration IS 'Percentage of revenue from top 5 customers';
COMMENT ON COLUMN public.listings.market_position IS 'Market ranking and geographic coverage details';
COMMENT ON COLUMN public.listings.transaction_preferences IS 'Seller preferences for deal structure and timeline';
COMMENT ON COLUMN public.listings.growth_drivers IS 'Array of specific growth opportunities';
COMMENT ON COLUMN public.listings.key_risks IS 'Array of material business risks';
COMMENT ON COLUMN public.listings.investment_thesis IS 'Dedicated investment thesis separate from business overview';
COMMENT ON COLUMN public.listings.seller_involvement_preference IS 'Post-transaction involvement preference';
COMMENT ON COLUMN public.listings.timeline_preference IS 'Preferred transaction timeline';