-- Add missing enrichment columns to remarketing_buyers
ALTER TABLE public.remarketing_buyers 
  ADD COLUMN IF NOT EXISTS services_offered TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS revenue_model TEXT;

-- Add helpful comments
COMMENT ON COLUMN public.remarketing_buyers.services_offered IS 'Primary services or products offered by the company';
COMMENT ON COLUMN public.remarketing_buyers.business_type IS 'Type of business (Service Provider, Manufacturer, etc.)';
COMMENT ON COLUMN public.remarketing_buyers.revenue_model IS 'How the company generates revenue';