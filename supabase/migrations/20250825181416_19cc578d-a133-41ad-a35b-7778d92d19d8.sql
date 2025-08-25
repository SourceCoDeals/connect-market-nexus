-- Update revenue range columns to text type since we're storing labels like "$1M - $5M"
ALTER TABLE public.profiles ALTER COLUMN revenue_range_min TYPE text;
ALTER TABLE public.profiles ALTER COLUMN revenue_range_max TYPE text;