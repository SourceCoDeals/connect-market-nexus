-- Create criteria extraction sources table
CREATE TABLE IF NOT EXISTS criteria_extraction_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid NOT NULL REFERENCES remarketing_buyer_universes(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'ai_guide', -- 'ai_guide', 'document', 'transcript'
  source_name text,
  source_metadata jsonb DEFAULT '{}'::jsonb,
  extraction_status text NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extraction_started_at timestamptz,
  extraction_completed_at timestamptz,
  extraction_error text,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  confidence_scores jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_criteria_extraction_sources_universe_id ON criteria_extraction_sources(universe_id);
CREATE INDEX idx_criteria_extraction_sources_status ON criteria_extraction_sources(extraction_status);

-- Add updated_at trigger
CREATE TRIGGER set_criteria_extraction_sources_updated_at
  BEFORE UPDATE ON criteria_extraction_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE criteria_extraction_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own extraction sources"
  ON criteria_extraction_sources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM remarketing_buyer_universes u
      WHERE u.id = criteria_extraction_sources.universe_id
      AND u.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert extraction sources for their universes"
  ON criteria_extraction_sources
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM remarketing_buyer_universes u
      WHERE u.id = criteria_extraction_sources.universe_id
      AND u.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own extraction sources"
  ON criteria_extraction_sources
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM remarketing_buyer_universes u
      WHERE u.id = criteria_extraction_sources.universe_id
      AND u.created_by = auth.uid()
    )
  );

-- Service role bypass for edge functions
CREATE POLICY "Service role can manage all extraction sources"
  ON criteria_extraction_sources
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');