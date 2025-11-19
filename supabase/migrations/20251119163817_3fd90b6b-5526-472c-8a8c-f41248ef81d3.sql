-- Backfill migration: Set default values for new metric fields on existing listings

-- Set default revenue subtitles (use category as default)
UPDATE listings
SET revenue_metric_subtitle = category
WHERE revenue_metric_subtitle IS NULL AND category IS NOT NULL;

-- Set default EBITDA subtitles (margin percentage)
UPDATE listings
SET ebitda_metric_subtitle = CONCAT(
  '~',
  ROUND((ebitda::numeric / NULLIF(revenue, 0) * 100)::numeric, 1)::text,
  '% margin profile'
)
WHERE ebitda_metric_subtitle IS NULL AND revenue > 0;

-- Set fallback EBITDA subtitle for zero revenue listings
UPDATE listings
SET ebitda_metric_subtitle = 'Owner''s Discretionary Earnings'
WHERE ebitda_metric_subtitle IS NULL;

-- Ensure metric_3_type has default value
UPDATE listings
SET metric_3_type = 'employees'
WHERE metric_3_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN listings.revenue_metric_subtitle IS 'Optional subtitle text shown below revenue metric on listing detail page';
COMMENT ON COLUMN listings.ebitda_metric_subtitle IS 'Optional subtitle text shown below EBITDA metric on listing detail page';
COMMENT ON COLUMN listings.metric_3_type IS 'Type of third metric: employees (default) or custom';
COMMENT ON COLUMN listings.presented_by_admin_id IS 'Email of admin presenting this deal (references ADMIN_PROFILES in code)';