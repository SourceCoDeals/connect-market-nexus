-- Create table for tracking M&A guide generation progress
CREATE TABLE IF NOT EXISTS ma_guide_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid NOT NULL REFERENCES remarketing_universes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  current_phase text,
  phases_completed integer DEFAULT 0,
  total_phases integer DEFAULT 13,
  generated_content jsonb DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,

  -- Only allow one active generation per universe at a time
  CONSTRAINT unique_active_generation UNIQUE NULLS NOT DISTINCT (universe_id, CASE WHEN status IN ('pending', 'processing') THEN status END)
);

-- Add index for efficient lookups
CREATE INDEX idx_ma_guide_generations_universe_id ON ma_guide_generations(universe_id);
CREATE INDEX idx_ma_guide_generations_status ON ma_guide_generations(status);

-- Add updated_at trigger
CREATE TRIGGER set_ma_guide_generations_updated_at
  BEFORE UPDATE ON ma_guide_generations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ma_guide_generations ENABLE ROW LEVEL SECURITY;

-- RLS Policies (same as remarketing_universes - users can only see their own)
CREATE POLICY "Users can view their own guide generations"
  ON ma_guide_generations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM remarketing_universes u
      WHERE u.id = ma_guide_generations.universe_id
      AND u.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert guide generations for their universes"
  ON ma_guide_generations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM remarketing_universes u
      WHERE u.id = ma_guide_generations.universe_id
      AND u.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own guide generations"
  ON ma_guide_generations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM remarketing_universes u
      WHERE u.id = ma_guide_generations.universe_id
      AND u.user_id = auth.uid()
    )
  );
