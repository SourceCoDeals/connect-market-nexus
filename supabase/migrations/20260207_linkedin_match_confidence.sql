-- Add LinkedIn match quality tracking columns
-- Enables monitoring and manual review of LinkedIn profile matches

-- Add confidence level column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS linkedin_match_confidence TEXT
  CHECK (linkedin_match_confidence IN ('high', 'medium', 'low', 'manual', 'failed'));

-- Add match signals JSONB column to store verification details
ALTER TABLE listings ADD COLUMN IF NOT EXISTS linkedin_match_signals JSONB;

-- Add timestamp for when LinkedIn was verified
ALTER TABLE listings ADD COLUMN IF NOT EXISTS linkedin_verified_at TIMESTAMPTZ;

-- Create index for finding low-confidence matches that need review
CREATE INDEX IF NOT EXISTS idx_listings_linkedin_confidence
  ON listings(linkedin_match_confidence)
  WHERE linkedin_match_confidence IN ('low', 'failed');

-- Create index for recent verifications
CREATE INDEX IF NOT EXISTS idx_listings_linkedin_verified
  ON listings(linkedin_verified_at DESC)
  WHERE linkedin_verified_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN listings.linkedin_match_confidence IS
  'Confidence level of LinkedIn profile match: high (verified match), medium (likely correct), low (uncertain), manual (user provided), failed (verification failed)';

COMMENT ON COLUMN listings.linkedin_match_signals IS
  'JSON object storing verification signals: { websiteMatch: boolean, locationMatch: { match: boolean, confidence: string, reason: string }, foundViaSearch: boolean, employeeCountRatio: number }';

COMMENT ON COLUMN listings.linkedin_verified_at IS
  'Timestamp when LinkedIn profile was last verified/matched';

-- Create view for manual review queue
CREATE OR REPLACE VIEW linkedin_manual_review_queue AS
SELECT
  l.id,
  l.title,
  l.internal_company_name,
  l.address_city,
  l.address_state,
  l.website,
  l.linkedin_url,
  l.linkedin_match_confidence,
  l.linkedin_match_signals,
  l.full_time_employees,
  l.linkedin_employee_count,
  l.linkedin_headquarters,
  l.linkedin_verified_at,
  -- Calculate employee count ratio for red flags
  CASE
    WHEN l.full_time_employees > 0 AND l.linkedin_employee_count IS NOT NULL
    THEN ROUND((l.linkedin_employee_count::numeric / l.full_time_employees::numeric), 2)
    ELSE NULL
  END as employee_count_ratio,
  -- Flag for suspicious mismatches
  CASE
    WHEN l.full_time_employees > 0 AND l.linkedin_employee_count IS NOT NULL
         AND (l.linkedin_employee_count > l.full_time_employees * 5 OR l.linkedin_employee_count < l.full_time_employees / 5)
    THEN true
    ELSE false
  END as suspicious_employee_mismatch,
  l.updated_at
FROM listings l
WHERE
  -- Include profiles that need review
  (
    l.linkedin_match_confidence IN ('low', 'failed')
    OR (
      -- Or profiles with suspicious employee count mismatches
      l.full_time_employees > 0
      AND l.linkedin_employee_count IS NOT NULL
      AND (l.linkedin_employee_count > l.full_time_employees * 5 OR l.linkedin_employee_count < l.full_time_employees / 5)
    )
  )
  AND l.linkedin_url IS NOT NULL  -- Only for profiles that have LinkedIn data
ORDER BY
  CASE l.linkedin_match_confidence
    WHEN 'failed' THEN 1
    WHEN 'low' THEN 2
    ELSE 3
  END,
  l.updated_at DESC;

COMMENT ON VIEW linkedin_manual_review_queue IS
  'Queue of LinkedIn profiles that need manual review due to low confidence or suspicious data mismatches';

-- Create helper function to update match confidence
CREATE OR REPLACE FUNCTION update_linkedin_match_confidence(
  p_listing_id UUID,
  p_confidence TEXT,
  p_signals JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE listings
  SET
    linkedin_match_confidence = p_confidence,
    linkedin_match_signals = COALESCE(p_signals, linkedin_match_signals),
    linkedin_verified_at = NOW()
  WHERE id = p_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_linkedin_match_confidence IS
  'Helper function to update LinkedIn match confidence and verification timestamp';
