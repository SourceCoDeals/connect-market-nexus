-- Add Fireflies-specific fields to deal_transcripts table
-- Allows storing transcript references without full content

ALTER TABLE deal_transcripts
ADD COLUMN IF NOT EXISTS fireflies_transcript_id TEXT,
ADD COLUMN IF NOT EXISTS fireflies_meeting_id TEXT,
ADD COLUMN IF NOT EXISTS participants JSONB,
ADD COLUMN IF NOT EXISTS meeting_attendees TEXT[],
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS auto_linked BOOLEAN DEFAULT false;

-- Unique constraint on Fireflies transcript ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_transcripts_fireflies_id_unique
ON deal_transcripts(fireflies_transcript_id)
WHERE fireflies_transcript_id IS NOT NULL;

-- Index for Fireflies lookups
CREATE INDEX IF NOT EXISTS idx_deal_transcripts_fireflies_id
ON deal_transcripts(fireflies_transcript_id)
WHERE fireflies_transcript_id IS NOT NULL;

-- Prevent duplicate Fireflies transcripts per deal
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_transcripts_unique_fireflies_per_deal
ON deal_transcripts(listing_id, fireflies_transcript_id)
WHERE fireflies_transcript_id IS NOT NULL;

-- Index for auto-linked filtering
CREATE INDEX IF NOT EXISTS idx_deal_transcripts_auto_linked
ON deal_transcripts(auto_linked)
WHERE auto_linked = true;

-- Comments
COMMENT ON COLUMN deal_transcripts.fireflies_transcript_id IS
'Fireflies transcript ID - primary key from Fireflies API (e.g., "transcript_abc123")';

COMMENT ON COLUMN deal_transcripts.fireflies_meeting_id IS
'Fireflies meeting ID - can have multiple transcripts per meeting';

COMMENT ON COLUMN deal_transcripts.participants IS
'JSONB array of participant objects from Fireflies (includes name, email, etc.)';

COMMENT ON COLUMN deal_transcripts.meeting_attendees IS
'Simple text array of participant emails for easy filtering';

COMMENT ON COLUMN deal_transcripts.duration_minutes IS
'Call duration in minutes (derived from Fireflies duration_seconds)';

COMMENT ON COLUMN deal_transcripts.auto_linked IS
'True if automatically linked via participant email match, false if manually uploaded';

-- Allow transcript_text to be empty initially (fetched on-demand)
-- This is already nullable, just documenting the intent
COMMENT ON COLUMN deal_transcripts.transcript_text IS
'Full transcript text. Empty for Fireflies transcripts until fetched on-demand, then cached here.';
