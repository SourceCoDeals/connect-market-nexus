-- Add new quality scoring columns for v2 scoring methodology
-- Enables tracking of individual score components and LinkedIn boost

-- Add revenue score column (0-60 pts)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS revenue_score INTEGER;

-- Add EBITDA score column (0-40 pts)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ebitda_score INTEGER;

-- Add LinkedIn employee boost column (0-25 pts)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS linkedin_boost INTEGER;

-- Add quality calculation version column for tracking methodology changes
ALTER TABLE listings ADD COLUMN IF NOT EXISTS quality_calculation_version TEXT;

-- Create indexes for querying by score components
CREATE INDEX IF NOT EXISTS idx_listings_revenue_score
  ON listings(revenue_score DESC)
  WHERE revenue_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_ebitda_score
  ON listings(ebitda_score DESC)
  WHERE ebitda_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_linkedin_boost
  ON listings(linkedin_boost DESC)
  WHERE linkedin_boost IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_quality_version
  ON listings(quality_calculation_version)
  WHERE quality_calculation_version IS NOT NULL;

-- Comments
COMMENT ON COLUMN listings.revenue_score IS
  'Revenue component score (0-60 pts) from quality scoring v2. Uses exponential curve: $1-5M = 15-40 pts, $5-10M = 40-54 pts, $10M+ = 54-60 pts';

COMMENT ON COLUMN listings.ebitda_score IS
  'EBITDA component score (0-40 pts) from quality scoring v2. Uses exponential curve: $300K-1M = 5-20 pts, $1-3M = 20-35 pts, $3M+ = 35-40 pts';

COMMENT ON COLUMN listings.linkedin_boost IS
  'LinkedIn employee count boost (0-25 pts) applied even when financials exist. 100+ employees = +20-25 pts, 50-99 = +10-15 pts, 25-49 = +5-10 pts';

COMMENT ON COLUMN listings.quality_calculation_version IS
  'Version of quality scoring methodology used. v2.0 = exponential curves + LinkedIn boost';

-- Create view for scoring analysis
CREATE OR REPLACE VIEW deal_quality_analysis AS
SELECT
  l.id,
  l.title,
  l.internal_company_name,
  l.deal_total_score,
  l.deal_size_score,
  l.revenue_score,
  l.ebitda_score,
  l.linkedin_boost,
  l.quality_calculation_version,
  l.revenue,
  l.ebitda,
  l.linkedin_employee_count,
  -- Calculate score breakdown percentages
  CASE
    WHEN l.deal_total_score > 0 THEN ROUND((l.revenue_score::numeric / l.deal_total_score::numeric) * 100, 1)
    ELSE NULL
  END as revenue_pct,
  CASE
    WHEN l.deal_total_score > 0 THEN ROUND((l.ebitda_score::numeric / l.deal_total_score::numeric) * 100, 1)
    ELSE NULL
  END as ebitda_pct,
  CASE
    WHEN l.deal_total_score > 0 THEN ROUND((l.linkedin_boost::numeric / l.deal_total_score::numeric) * 100, 1)
    ELSE NULL
  END as linkedin_boost_pct,
  -- Identify scoring path
  CASE
    WHEN l.revenue > 0 OR l.ebitda > 0 THEN 'financials'
    WHEN l.linkedin_employee_count > 0 THEN 'linkedin_proxy'
    WHEN l.google_review_count > 0 THEN 'reviews_proxy'
    ELSE 'no_data'
  END as scoring_path,
  -- Flag deals that would benefit from LinkedIn boost
  CASE
    WHEN l.linkedin_employee_count >= 100 AND l.linkedin_boost IS NULL THEN true
    ELSE false
  END as missing_linkedin_boost
FROM listings l
WHERE l.deal_total_score IS NOT NULL
ORDER BY l.deal_total_score DESC;

COMMENT ON VIEW deal_quality_analysis IS
  'Analysis view for quality scoring breakdown and identifying scoring improvements';
