-- Add columns for Fireflies integration improvements
ALTER TABLE deal_transcripts ADD COLUMN IF NOT EXISTS has_content boolean DEFAULT true;
ALTER TABLE deal_transcripts ADD COLUMN IF NOT EXISTS match_type text DEFAULT 'email';
ALTER TABLE deal_transcripts ADD COLUMN IF NOT EXISTS external_participants jsonb;