-- =============================================================================
-- Call recordings storage bucket
-- =============================================================================
-- PhoneBurner returns presigned recording URLs that expire after a retention
-- window. contact_activities.recording_url_public stores the URL as-is, so
-- once PB's expiry hits the link 404s and the recording is effectively lost.
-- For pipeline reviews, compliance audits, and onboarding replay, we need
-- recordings to survive past PB's window.
--
-- This migration creates a private Storage bucket for archived MP3s and an
-- RLS policy matching the contact_activities visibility model (admin read +
-- service role write). The actual download-and-upload is done by the
-- archive-call-recording edge function, invoked async from
-- phoneburner-webhook on the call_end event.
--
-- We also add a contact_activities.recording_storage_path column so the
-- archived copy is discoverable from a call row without parsing the URL.
-- =============================================================================

-- Bucket (INSERT...ON CONFLICT so re-applying is a no-op). Private — callers
-- fetch signed URLs on demand, same pattern as buyer-transcripts.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('call-recordings', 'call-recordings', false)
  ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects for this bucket.
DROP POLICY IF EXISTS "Admins read call recordings" ON storage.objects;
CREATE POLICY "Admins read call recordings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'call-recordings' AND public.is_admin(auth.uid()));

-- Service-role writes are implicit (service role bypasses RLS). We don't
-- grant authenticated inserts — recording upload happens only in the
-- archive-call-recording edge function.

-- contact_activities: add the archived storage path so the webhook and UI
-- can find the archived copy without parsing the URL.
ALTER TABLE public.contact_activities
  ADD COLUMN IF NOT EXISTS recording_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS recording_archived_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ca_recording_archive_pending
  ON public.contact_activities(created_at DESC)
  WHERE source_system = 'phoneburner'
    AND recording_url IS NOT NULL
    AND recording_storage_path IS NULL;

COMMENT ON COLUMN public.contact_activities.recording_storage_path IS
  'Path (relative to storage.call-recordings bucket) of the archived MP3 '
  'copy of recording_url. NULL until archive-call-recording runs.';

COMMENT ON COLUMN public.contact_activities.recording_archived_at IS
  'When archive-call-recording successfully fetched and uploaded the '
  'recording. Lets us distinguish "archive pending" from "archive failed".';
