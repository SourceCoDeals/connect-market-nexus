-- Create buyer_transcripts table for manual transcript attachment
-- Buyers can search Fireflies and link relevant calls

CREATE TABLE IF NOT EXISTS buyer_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES remarketing_buyers(id) ON DELETE CASCADE,

  -- Fireflies reference
  fireflies_transcript_id TEXT NOT NULL,
  transcript_url TEXT,

  -- Metadata from Fireflies
  title TEXT,
  call_date TIMESTAMPTZ,
  participants JSONB,
  duration_minutes INTEGER,

  -- AI-extracted insights
  summary TEXT,
  key_points TEXT[],
  action_items TEXT[],

  -- Linking metadata
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_by UUID REFERENCES auth.users(id),
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_buyer_transcripts_buyer_id
ON buyer_transcripts(buyer_id);

CREATE INDEX idx_buyer_transcripts_fireflies_id
ON buyer_transcripts(fireflies_transcript_id);

CREATE INDEX idx_buyer_transcripts_call_date
ON buyer_transcripts(call_date DESC);

-- Prevent duplicate links
CREATE UNIQUE INDEX idx_buyer_transcripts_unique_link
ON buyer_transcripts(buyer_id, fireflies_transcript_id);

-- RLS policies
ALTER TABLE buyer_transcripts ENABLE ROW LEVEL SECURITY;

-- Users can view transcripts for buyers they have access to
CREATE POLICY "Users can view buyer transcripts they have access to"
ON buyer_transcripts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM remarketing_buyers
    WHERE id = buyer_transcripts.buyer_id
  )
);

-- Users can insert transcripts for buyers they have access to
CREATE POLICY "Users can insert buyer transcripts they have access to"
ON buyer_transcripts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM remarketing_buyers
    WHERE id = buyer_transcripts.buyer_id
  )
);

-- Users can update transcripts for buyers they have access to
CREATE POLICY "Users can update buyer transcripts they have access to"
ON buyer_transcripts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM remarketing_buyers
    WHERE id = buyer_transcripts.buyer_id
  )
);

-- Users can delete transcripts they linked
CREATE POLICY "Users can delete buyer transcripts they linked"
ON buyer_transcripts FOR DELETE
USING (linked_by = auth.uid());

-- Comments
COMMENT ON TABLE buyer_transcripts IS
'Links Fireflies transcripts to buyers for manual call history tracking';

COMMENT ON COLUMN buyer_transcripts.fireflies_transcript_id IS
'Reference to Fireflies transcript - full content fetched on-demand';

COMMENT ON COLUMN buyer_transcripts.linked_by IS
'User who linked this transcript to the buyer';

COMMENT ON COLUMN buyer_transcripts.notes IS
'User notes about why this transcript is relevant to the buyer';
