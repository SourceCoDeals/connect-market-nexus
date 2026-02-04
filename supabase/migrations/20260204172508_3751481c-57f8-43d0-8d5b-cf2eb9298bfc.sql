-- Add M&A Intelligence criteria columns to industry_trackers table
ALTER TABLE public.industry_trackers ADD COLUMN IF NOT EXISTS size_criteria jsonb;
ALTER TABLE public.industry_trackers ADD COLUMN IF NOT EXISTS service_criteria jsonb;
ALTER TABLE public.industry_trackers ADD COLUMN IF NOT EXISTS geography_criteria jsonb;
ALTER TABLE public.industry_trackers ADD COLUMN IF NOT EXISTS buyer_types_criteria jsonb;
ALTER TABLE public.industry_trackers ADD COLUMN IF NOT EXISTS kpi_scoring_config jsonb;

-- Add scoring weight columns
ALTER TABLE public.industry_trackers ADD COLUMN IF NOT EXISTS geography_weight numeric DEFAULT 1.0;
ALTER TABLE public.industry_trackers ADD COLUMN IF NOT EXISTS service_mix_weight numeric DEFAULT 1.0;
ALTER TABLE public.industry_trackers ADD COLUMN IF NOT EXISTS size_weight numeric DEFAULT 1.0;
ALTER TABLE public.industry_trackers ADD COLUMN IF NOT EXISTS owner_goals_weight numeric DEFAULT 1.0;

-- Add archived column
ALTER TABLE public.industry_trackers ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- Add index for archived filter
CREATE INDEX IF NOT EXISTS idx_industry_trackers_archived ON public.industry_trackers(archived);