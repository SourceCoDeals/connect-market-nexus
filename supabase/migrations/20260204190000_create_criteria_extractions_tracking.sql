-- Create table for tracking buyer criteria extraction progress
-- Similar to ma_guide_generations but for extraction operations

CREATE TABLE IF NOT EXISTS buyer_criteria_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid NOT NULL REFERENCES remarketing_universes(id) ON DELETE CASCADE,
  source_id uuid REFERENCES criteria_extraction_sources(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  current_phase text,
  phases_completed integer DEFAULT 0,
  total_phases integer DEFAULT 4, -- Size, Service, Geography, Buyer Types
  extracted_criteria jsonb DEFAULT '{}'::jsonb,
  confidence_scores jsonb DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,

  -- Only allow one active extraction per universe at a time
  CONSTRAINT unique_active_extraction UNIQUE NULLS NOT DISTINCT (universe_id, CASE WHEN status IN ('pending', 'processing') THEN status END)
);

-- Add index for efficient lookups
CREATE INDEX idx_buyer_criteria_extractions_universe_id ON buyer_criteria_extractions(universe_id);
CREATE INDEX idx_buyer_criteria_extractions_status ON buyer_criteria_extractions(status);
CREATE INDEX idx_buyer_criteria_extractions_source_id ON buyer_criteria_extractions(source_id);

-- Add updated_at trigger
CREATE TRIGGER set_buyer_criteria_extractions_updated_at
  BEFORE UPDATE ON buyer_criteria_extractions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE buyer_criteria_extractions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (same as remarketing_universes - users can only see their own)
CREATE POLICY "Users can view their own criteria extractions"
  ON buyer_criteria_extractions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM remarketing_universes u
      WHERE u.id = buyer_criteria_extractions.universe_id
      AND u.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert criteria extractions for their universes"
  ON buyer_criteria_extractions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM remarketing_universes u
      WHERE u.id = buyer_criteria_extractions.universe_id
      AND u.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own criteria extractions"
  ON buyer_criteria_extractions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM remarketing_universes u
      WHERE u.id = buyer_criteria_extractions.universe_id
      AND u.user_id = auth.uid()
    )
  );

-- Add cleanup function for zombie extractions (stuck in 'processing' for >10 minutes)
CREATE OR REPLACE FUNCTION cleanup_zombie_criteria_extractions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE buyer_criteria_extractions
  SET
    status = 'failed',
    error = 'Extraction timed out after 10 minutes',
    completed_at = now(),
    updated_at = now()
  WHERE
    status = 'processing'
    AND started_at < now() - interval '10 minutes';

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

COMMENT ON FUNCTION cleanup_zombie_criteria_extractions IS
  'Marks criteria extractions stuck in processing status for >10 minutes as failed';
