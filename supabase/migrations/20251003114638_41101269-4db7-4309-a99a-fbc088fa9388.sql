-- Add filter_config column to pipeline_views for storing filter state
ALTER TABLE public.pipeline_views 
ADD COLUMN IF NOT EXISTS filter_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.pipeline_views.filter_config IS 'Stores filter state including search, status, priority, categories, locations, revenue/ebitda ranges, buyer types, and sort preferences';