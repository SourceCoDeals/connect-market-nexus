-- Backfill historical decision attribution from follow-up admin
-- Only fills NULL attribution fields; never overwrites existing data
BEGIN;

-- Approved decisions: set approved_by from followed_up_by when missing
UPDATE public.connection_requests
SET approved_by = followed_up_by
WHERE status = 'approved'
  AND approved_by IS NULL
  AND followed_up_by IS NOT NULL;

-- Rejected decisions: set rejected_by from followed_up_by when missing
UPDATE public.connection_requests
SET rejected_by = followed_up_by
WHERE status = 'rejected'
  AND rejected_by IS NULL
  AND followed_up_by IS NOT NULL;

-- On hold decisions: set on_hold_by from followed_up_by when missing
UPDATE public.connection_requests
SET on_hold_by = followed_up_by
WHERE status = 'on_hold'
  AND on_hold_by IS NULL
  AND followed_up_by IS NOT NULL;

COMMIT;