-- Call Transcripts Intelligence
-- Stores and processes call transcripts (highest priority data source: 100)
-- Extracts deal/buyer insights using 8-prompt architecture from Whispers

CREATE TABLE IF NOT EXISTS call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES remarketing_buyers(id) ON DELETE CASCADE,
  transcript_text TEXT NOT NULL,
  call_date TIMESTAMPTZ NOT NULL,
  call_duration_minutes INTEGER,
  participants TEXT[],
  call_type TEXT CHECK (call_type IN (
    'seller_call',
    'buyer_call',
    'seller_buyer_intro',
    'management_presentation',
    'q_and_a',
    'site_visit_debrief',
    'other'
  )),
  extracted_insights JSONB,
  key_quotes TEXT[],
  ceo_detected BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN (
    'pending',
    'processing',
    'completed',
    'failed'
  )),
  processing_error TEXT,
  file_url TEXT,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_call_transcripts_listing ON call_transcripts(listing_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_buyer ON call_transcripts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_date ON call_transcripts(call_date DESC);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_status ON call_transcripts(processing_status);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_ceo ON call_transcripts(ceo_detected) WHERE ceo_detected = true;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_call_transcript_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER call_transcripts_updated_at
  BEFORE UPDATE ON call_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION update_call_transcript_timestamp();

-- Add comment explaining the table
COMMENT ON TABLE call_transcripts IS 'Stores call transcripts and extracted insights. Transcripts are highest priority data source (100) and can overwrite all other sources.';
COMMENT ON COLUMN call_transcripts.extracted_insights IS 'JSONB containing extracted insights from 8-prompt architecture: financials, services, geography, owner_goals, buyer_criteria, deal_structure, etc.';
COMMENT ON COLUMN call_transcripts.key_quotes IS 'Array of verbatim quotes from transcript that provide context for extracted data';
COMMENT ON COLUMN call_transcripts.ceo_detected IS 'True if CEO/owner was detected in transcript - triggers engagement signal (+40 points)';

-- RLS Policies
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin full access to call transcripts"
  ON call_transcripts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'admin'
           OR auth.users.raw_user_meta_data->>'role' = 'super_admin')
    )
  );

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to call transcripts"
  ON call_transcripts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
