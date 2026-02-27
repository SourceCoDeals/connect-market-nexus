-- Fix deal_transcripts records with invalid source values
-- Records with Fireflies URLs stored in source column should use 'fireflies'
UPDATE deal_transcripts
SET source = 'fireflies'
WHERE source LIKE 'https://app.fireflies.ai/%';

-- Fix Fireflies transcripts missing fireflies_transcript_id
-- Extract the ID portion from the transcript_url if available
UPDATE deal_transcripts
SET fireflies_transcript_id = COALESCE(
  -- Try to extract from transcript_url: last path segment
  CASE
    WHEN transcript_url IS NOT NULL AND transcript_url LIKE '%fireflies.ai%'
    THEN regexp_replace(transcript_url, '^.*/([^/]+)$', '\1')
    ELSE NULL
  END,
  -- Fallback: generate a placeholder so the NOT NULL expectation is met
  'unknown-' || id::text
)
WHERE source = 'fireflies'
  AND fireflies_transcript_id IS NULL;
