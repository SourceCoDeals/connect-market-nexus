-- Add metric_4 configuration fields to listings table
ALTER TABLE public.listings
ADD COLUMN metric_4_type text DEFAULT 'ebitda_margin',
ADD COLUMN metric_4_custom_label text,
ADD COLUMN metric_4_custom_value text,
ADD COLUMN metric_4_custom_subtitle text;

-- Migrate existing custom_metric data to metric_4_custom
UPDATE public.listings
SET 
  metric_4_type = 'custom',
  metric_4_custom_label = custom_metric_label,
  metric_4_custom_value = custom_metric_value,
  metric_4_custom_subtitle = custom_metric_subtitle
WHERE custom_metric_label IS NOT NULL AND custom_metric_label != '';

-- Add helpful comment
COMMENT ON COLUMN public.listings.metric_4_type IS 'Type of 4th metric: ebitda_margin (calculated) or custom';
COMMENT ON COLUMN public.listings.metric_4_custom_label IS 'Label for custom 4th metric';
COMMENT ON COLUMN public.listings.metric_4_custom_value IS 'Value for custom 4th metric';
COMMENT ON COLUMN public.listings.metric_4_custom_subtitle IS 'Subtitle for 4th metric (works for both ebitda_margin and custom)';