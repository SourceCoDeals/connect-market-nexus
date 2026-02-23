-- Add fields for improved Fireflies integration:
-- has_content: flag for silent/skipped meetings with no transcript content
-- match_type: how the transcript was matched to the deal (email, domain, keyword)
-- external_participants: non-internal participant info for display

ALTER TABLE deal_transcripts
ADD COLUMN IF NOT EXISTS has_content boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS match_type text DEFAULT 'email',
ADD COLUMN IF NOT EXISTS external_participants jsonb;

-- Index for filtering by match_type
CREATE INDEX IF NOT EXISTS idx_deal_transcripts_match_type
ON deal_transcripts(match_type)
WHERE match_type IS NOT NULL;

-- Index for filtering transcripts with/without content
CREATE INDEX IF NOT EXISTS idx_deal_transcripts_has_content
ON deal_transcripts(has_content)
WHERE has_content = false;

-- Comments
COMMENT ON COLUMN deal_transcripts.has_content IS
'False when Fireflies marked meeting as silent/skipped with no transcript captured. These are displayed with a warning label.';

COMMENT ON COLUMN deal_transcripts.match_type IS
'How this transcript was matched to the deal: email (direct participant match), domain (matched by company domain), keyword (fallback matched by company name in content)';

COMMENT ON COLUMN deal_transcripts.external_participants IS
'JSONB array of {name, email} for non-internal participants (excludes @sourcecodeals.com and @captarget.com addresses)';
