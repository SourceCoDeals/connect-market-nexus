-- Add transcript enhancement columns
ALTER TABLE deal_transcripts 
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS transcript_url text,
ADD COLUMN IF NOT EXISTS call_date timestamp with time zone;

-- Add owner_goals extraction to enrich-deal if missing
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS owner_goals text;