-- Portal Intelligence — Phase 2
-- Builds on 20260703000000 + 20260703000001 to ship:
--   1. Storage bucket for intelligence doc file uploads (admin-only)
--   2. portal_recommendation_events audit trail + triggers
--   3. Nightly cron to hard-delete stale recommendations older than 30 days
--   4. portal_pass_reason_summary view so admins can see why clients pass
--   5. strong_match_alerted_at column so the UI can badge unseen strong matches
--   6. Notice on pg_cron missing (so deploy failures are visible)

-- All statements are idempotent.

-- ================================================================
-- 1. Storage bucket for intelligence doc uploads
-- ================================================================
-- Bucket is private; only admins can read/write via RLS on storage.objects.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portal-intelligence-docs',
  'portal-intelligence-docs',
  FALSE,
  26214400, -- 25 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/webm'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = EXCLUDED.public;

DROP POLICY IF EXISTS "Admins read portal intelligence docs" ON storage.objects;
CREATE POLICY "Admins read portal intelligence docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'portal-intelligence-docs'
    AND public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins write portal intelligence docs" ON storage.objects;
CREATE POLICY "Admins write portal intelligence docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'portal-intelligence-docs'
    AND public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins delete portal intelligence docs" ON storage.objects;
CREATE POLICY "Admins delete portal intelligence docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'portal-intelligence-docs'
    AND public.is_admin(auth.uid())
  );

-- ================================================================
-- 2. portal_recommendation_events — audit trail
-- Tracks every status change, who made it, and when.
-- ================================================================
CREATE TABLE IF NOT EXISTS portal_recommendation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES portal_deal_recommendations(id) ON DELETE CASCADE,
  portal_org_id UUID NOT NULL REFERENCES portal_organizations(id) ON DELETE CASCADE,
  listing_id UUID, -- soft reference; listing may be deleted
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'score_updated', 'approved', 'pushed', 'dismissed', 'stale', 'reactivated'
  )),
  previous_status TEXT,
  new_status TEXT,
  previous_score INTEGER,
  new_score INTEGER,
  actor_id UUID REFERENCES profiles(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE portal_recommendation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read recommendation events" ON portal_recommendation_events;
CREATE POLICY "Admins read recommendation events"
  ON portal_recommendation_events FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Service role bypasses RLS for inserts from the edge function + trigger.

CREATE INDEX IF NOT EXISTS idx_pre_recommendation ON portal_recommendation_events(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_pre_org_created ON portal_recommendation_events(portal_org_id, created_at DESC);

-- Trigger function: log every insert and status/score change.
CREATE OR REPLACE FUNCTION public.log_portal_recommendation_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.portal_recommendation_events (
      recommendation_id, portal_org_id, listing_id,
      event_type, new_status, new_score, actor_id
    ) VALUES (
      NEW.id, NEW.portal_org_id, NEW.listing_id,
      'created', NEW.status, NEW.match_score, NEW.reviewed_by
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Status change events
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event_type := CASE
        WHEN NEW.status = 'approved' THEN 'approved'
        WHEN NEW.status = 'pushed'   THEN 'pushed'
        WHEN NEW.status = 'dismissed' THEN 'dismissed'
        WHEN NEW.status = 'stale'    THEN 'stale'
        WHEN NEW.status = 'pending'  THEN 'reactivated'
        ELSE 'score_updated'
      END;
      INSERT INTO public.portal_recommendation_events (
        recommendation_id, portal_org_id, listing_id,
        event_type, previous_status, new_status,
        previous_score, new_score, actor_id,
        metadata
      ) VALUES (
        NEW.id, NEW.portal_org_id, NEW.listing_id,
        v_event_type, OLD.status, NEW.status,
        OLD.match_score, NEW.match_score, NEW.reviewed_by,
        jsonb_build_object(
          'dismiss_reason', NEW.dismiss_reason,
          'push_id',        NEW.push_id
        )
      );
    -- Score-only change (no status transition)
    ELSIF NEW.match_score IS DISTINCT FROM OLD.match_score THEN
      INSERT INTO public.portal_recommendation_events (
        recommendation_id, portal_org_id, listing_id,
        event_type, previous_score, new_score
      ) VALUES (
        NEW.id, NEW.portal_org_id, NEW.listing_id,
        'score_updated', OLD.match_score, NEW.match_score
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_rec_audit ON portal_deal_recommendations;
CREATE TRIGGER trg_portal_rec_audit
  AFTER INSERT OR UPDATE ON portal_deal_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.log_portal_recommendation_event();

-- ================================================================
-- 3. Strong-match alert column + index
-- Used by the admin UI to badge unseen strong matches. When an admin
-- opens the Recommendations tab, the UI stamps strong_match_alerted_at
-- on every strong pending row so the badge clears.
-- ================================================================
ALTER TABLE portal_deal_recommendations
  ADD COLUMN IF NOT EXISTS strong_match_alerted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pdr_strong_unseen
  ON portal_deal_recommendations (portal_org_id)
  WHERE status = 'pending'
    AND match_category = 'strong'
    AND strong_match_alerted_at IS NULL;

-- ================================================================
-- 4. portal_pass_reason_summary view
-- Aggregates pass_reason_category counts per portal org so admins
-- can spot patterns ("this client passed 8 of 12 deals for too_small
-- — their EBITDA floor is probably wrong").
-- ================================================================
CREATE OR REPLACE VIEW portal_pass_reason_summary AS
SELECT
  p.portal_org_id,
  r.pass_reason_category,
  COUNT(*) AS pass_count,
  MAX(r.created_at) AS most_recent_at
FROM portal_deal_responses r
JOIN portal_deal_pushes p ON r.push_id = p.id
WHERE r.response_type = 'pass'
  AND r.pass_reason_category IS NOT NULL
GROUP BY p.portal_org_id, r.pass_reason_category;

COMMENT ON VIEW portal_pass_reason_summary IS
  'Per-portal aggregation of client pass reasons for thesis feedback loop.';

-- ================================================================
-- 5. Nightly cron: hard-delete stale recommendations older than 30 days
-- ================================================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_portal_recommendations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.portal_deal_recommendations
  WHERE status = 'stale'
    AND updated_at < now() - INTERVAL '30 days';
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('cleanup-stale-portal-recommendations');
    EXCEPTION WHEN others THEN NULL;
    END;

    PERFORM cron.schedule(
      'cleanup-stale-portal-recommendations',
      '0 3 * * *', -- 3am daily
      $sql$ SELECT public.cleanup_stale_portal_recommendations(); $sql$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not installed — cleanup-stale-portal-recommendations NOT scheduled. Install pg_cron and re-run this migration.';
  END IF;
END $$;

-- ================================================================
-- 6. Raise an explicit notice if pg_cron is missing so the previous
-- process-portal-recommendations schedule failure is visible.
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE WARNING 'pg_cron extension is not installed — process-portal-recommendations will NOT run automatically. Run CREATE EXTENSION pg_cron; and re-run 20260703000001_portal_intelligence_audit_fixes.sql.';
  END IF;
END $$;
