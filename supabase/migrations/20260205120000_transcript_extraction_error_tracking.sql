-- Migration: Add extraction error tracking for transcripts
-- Purpose: Track failed transcript extractions for monitoring and retry logic
-- Author: CTO Audit Fix #6
-- Date: 2026-02-05

-- Create extraction error tracking table
CREATE TABLE IF NOT EXISTS transcript_extraction_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL,
  transcript_type TEXT NOT NULL CHECK (transcript_type IN ('buyer', 'deal', 'call')),
  error_message TEXT,
  error_stack TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_transcript_extraction_errors_transcript_id
  ON transcript_extraction_errors(transcript_id);

CREATE INDEX IF NOT EXISTS idx_transcript_extraction_errors_type
  ON transcript_extraction_errors(transcript_type);

CREATE INDEX IF NOT EXISTS idx_transcript_extraction_errors_unresolved
  ON transcript_extraction_errors(resolved_at)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transcript_extraction_errors_created_at
  ON transcript_extraction_errors(created_at DESC);

-- Add comments
COMMENT ON TABLE transcript_extraction_errors IS 'Tracks failed transcript extractions for monitoring, alerting, and retry logic';
COMMENT ON COLUMN transcript_extraction_errors.transcript_id IS 'ID of the transcript that failed extraction (can reference buyer_transcripts, deal_transcripts, or call_transcripts)';
COMMENT ON COLUMN transcript_extraction_errors.transcript_type IS 'Type of transcript: buyer, deal, or call';
COMMENT ON COLUMN transcript_extraction_errors.error_message IS 'User-friendly error message';
COMMENT ON COLUMN transcript_extraction_errors.error_stack IS 'Full error stack trace for debugging';
COMMENT ON COLUMN transcript_extraction_errors.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN transcript_extraction_errors.last_retry_at IS 'Timestamp of most recent retry attempt';
COMMENT ON COLUMN transcript_extraction_errors.resolved_at IS 'Timestamp when error was resolved (extraction succeeded or manually marked resolved)';
COMMENT ON COLUMN transcript_extraction_errors.resolution_notes IS 'How the error was resolved';

-- Enable RLS
ALTER TABLE transcript_extraction_errors ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin users can view all errors
CREATE POLICY "Admin users can view extraction errors"
  ON transcript_extraction_errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = users.id
      AND users.email IN (
        SELECT email FROM profiles WHERE role = 'admin'
      )
    )
  );

-- RLS Policy: Service role can insert errors
CREATE POLICY "Service role can insert extraction errors"
  ON transcript_extraction_errors
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Service role can update errors
CREATE POLICY "Service role can update extraction errors"
  ON transcript_extraction_errors
  FOR UPDATE
  USING (true);
