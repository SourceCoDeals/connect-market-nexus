-- Add flagged_for_review columns to connection_requests table
-- Allows admins to flag connection requests for a specific team member to review

ALTER TABLE public.connection_requests
  ADD COLUMN IF NOT EXISTS flagged_for_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_for_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS flagged_for_review_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS flagged_for_review_assigned_to uuid REFERENCES public.profiles(id);

-- Index for quick filtering of flagged requests
CREATE INDEX IF NOT EXISTS idx_connection_requests_flagged
  ON public.connection_requests (flagged_for_review)
  WHERE flagged_for_review = true;

-- Index for filtering requests assigned to a specific reviewer
CREATE INDEX IF NOT EXISTS idx_connection_requests_flagged_assigned
  ON public.connection_requests (flagged_for_review_assigned_to)
  WHERE flagged_for_review_assigned_to IS NOT NULL;
