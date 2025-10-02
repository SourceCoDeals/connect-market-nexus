-- Add default_probability column to deal_stages table
ALTER TABLE public.deal_stages 
ADD COLUMN default_probability integer DEFAULT 50 CHECK (default_probability >= 0 AND default_probability <= 100);

COMMENT ON COLUMN public.deal_stages.default_probability IS 'Default win probability (0-100) for deals in this stage';

-- Update existing stages with reasonable default probabilities based on typical sales funnel
-- These can be customized by admins later
UPDATE public.deal_stages 
SET default_probability = CASE 
  WHEN LOWER(name) LIKE '%lead%' OR LOWER(name) LIKE '%initial%' THEN 10
  WHEN LOWER(name) LIKE '%qualif%' THEN 20
  WHEN LOWER(name) LIKE '%contact%' OR LOWER(name) LIKE '%meeting%' THEN 30
  WHEN LOWER(name) LIKE '%proposal%' OR LOWER(name) LIKE '%negotiat%' THEN 50
  WHEN LOWER(name) LIKE '%due%' OR LOWER(name) LIKE '%diligence%' THEN 70
  WHEN LOWER(name) LIKE '%closing%' OR LOWER(name) LIKE '%final%' THEN 90
  WHEN LOWER(name) LIKE '%won%' OR LOWER(name) LIKE '%closed%' THEN 100
  WHEN LOWER(name) LIKE '%lost%' OR LOWER(name) LIKE '%rejected%' THEN 0
  ELSE 50
END
WHERE default_probability IS NULL;