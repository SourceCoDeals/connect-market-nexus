-- Add LinkedIn URL, scoring, and push tracking columns to match_tool_leads
ALTER TABLE match_tool_leads
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS exclusion_reason text,
  ADD COLUMN IF NOT EXISTS quality_tier text,
  ADD COLUMN IF NOT EXISTS lead_score integer,
  ADD COLUMN IF NOT EXISTS scoring_notes text,
  ADD COLUMN IF NOT EXISTS pushed_to_all_deals_at timestamptz;
