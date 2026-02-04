-- Create unique index on company_website per universe (excluding archived and null websites)
CREATE UNIQUE INDEX IF NOT EXISTS idx_remarketing_buyers_unique_website_per_universe 
ON public.remarketing_buyers (universe_id, lower(company_website))
WHERE archived = false AND company_website IS NOT NULL AND company_website != '';