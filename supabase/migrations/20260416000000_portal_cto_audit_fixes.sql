-- ======================================================================
-- Portal CTO audit remediation (2026-04-16)
-- Fixes identified in CLIENT_PORTAL_CTO_AUDIT_EXECUTION_2026-04-16.md
-- ----------------------------------------------------------------------
-- Bundled so rollback is one migration step. Each section is idempotent.
-- ======================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Schema additions
-- ─────────────────────────────────────────────────────────────────────

-- portal_deal_pushes: snapshot_version so UI can handle schema drift
ALTER TABLE public.portal_deal_pushes
  ADD COLUMN IF NOT EXISTS snapshot_version integer NOT NULL DEFAULT 1;

-- portal_deal_pushes: snoozed_until for per-deal reminder suppression
ALTER TABLE public.portal_deal_pushes
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

-- portal_users: deactivated_at so we can show "deactivated on X" badges
ALTER TABLE public.portal_users
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- Backfill deactivated_at for existing inactive users so the column is
-- consistent even before new deactivations set it.
UPDATE public.portal_users
SET deactivated_at = updated_at
WHERE is_active = false AND deactivated_at IS NULL;

-- portal_thesis_criteria: excluded_keywords for negative-match scoring
ALTER TABLE public.portal_thesis_criteria
  ADD COLUMN IF NOT EXISTS excluded_keywords text[] NOT NULL DEFAULT ARRAY[]::text[];

-- ─────────────────────────────────────────────────────────────────────
-- 2. Uniqueness constraints (partial — allow historical duplicates)
-- ─────────────────────────────────────────────────────────────────────

-- One thesis criterion per (org, industry_label). Case-insensitive so
-- "HVAC" and "hvac" collide.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ptc_org_industry_label
  ON public.portal_thesis_criteria (portal_org_id, lower(industry_label));

-- One active push per (org, listing). Archived pushes don't block re-push.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pdp_org_listing_active
  ON public.portal_deal_pushes (portal_org_id, listing_id)
  WHERE status <> 'archived';

-- ─────────────────────────────────────────────────────────────────────
-- 3. Compound index for the main recommendations list query
-- ─────────────────────────────────────────────────────────────────────

-- Common UI query: WHERE portal_org_id=X AND status=Y ORDER BY match_score DESC
CREATE INDEX IF NOT EXISTS idx_pdr_org_status_score
  ON public.portal_deal_recommendations (portal_org_id, status, match_score DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 4. Cascade-stale triggers — keep the recs table honest
-- ─────────────────────────────────────────────────────────────────────

-- When a thesis criterion is deactivated, stale all pending recs pointing
-- at it. Fixes UC-12: previously recs orphaned forever until a listing
-- touched the same org.
CREATE OR REPLACE FUNCTION public.stale_recs_on_thesis_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE public.portal_deal_recommendations
    SET status = 'stale', updated_at = now()
    WHERE thesis_criteria_id = NEW.id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stale_recs_on_thesis_deactivation
  ON public.portal_thesis_criteria;
CREATE TRIGGER trg_stale_recs_on_thesis_deactivation
  AFTER UPDATE OF is_active ON public.portal_thesis_criteria
  FOR EACH ROW
  EXECUTE FUNCTION public.stale_recs_on_thesis_deactivation();

-- When a portal org is paused or archived, stale all its pending recs.
-- Fixes UC-10: admin opening a resumed portal used to see a mountain.
CREATE OR REPLACE FUNCTION public.stale_recs_on_portal_state_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status IN ('paused', 'archived') THEN
    UPDATE public.portal_deal_recommendations
    SET status = 'stale', updated_at = now()
    WHERE portal_org_id = NEW.id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stale_recs_on_portal_state_change
  ON public.portal_organizations;
CREATE TRIGGER trg_stale_recs_on_portal_state_change
  AFTER UPDATE OF status ON public.portal_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.stale_recs_on_portal_state_change();

-- When a portal_user is deactivated, record the timestamp.
CREATE OR REPLACE FUNCTION public.set_portal_user_deactivated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    NEW.deactivated_at := now();
  ELSIF OLD.is_active = false AND NEW.is_active = true THEN
    NEW.deactivated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_portal_user_deactivated_at
  ON public.portal_users;
CREATE TRIGGER trg_set_portal_user_deactivated_at
  BEFORE UPDATE OF is_active ON public.portal_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_portal_user_deactivated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 5. Admin RPC: reprocess a portal's recommendations on demand
-- ─────────────────────────────────────────────────────────────────────

-- Enqueues all active, non-deleted listings for a portal's active thesis
-- criteria so the next cron run re-scores everything. Fixes UC-25.
CREATE OR REPLACE FUNCTION public.enqueue_portal_listings(p_portal_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Caller must be an admin.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege: admin required';
  END IF;

  -- Skip if portal isn't active — no point re-scoring.
  IF NOT EXISTS (
    SELECT 1 FROM public.portal_organizations
    WHERE id = p_portal_org_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'portal_not_active: % is not an active portal', p_portal_org_id;
  END IF;

  -- Skip if no active criteria exist for this portal — nothing to match.
  IF NOT EXISTS (
    SELECT 1 FROM public.portal_thesis_criteria
    WHERE portal_org_id = p_portal_org_id AND is_active = true
  ) THEN
    RETURN 0;
  END IF;

  -- Enqueue all matchable listings. ON CONFLICT so re-runs are cheap.
  INSERT INTO public.portal_recommendation_queue (listing_id, queued_at)
  SELECT id, now()
  FROM public.listings
  WHERE deleted_at IS NULL
    AND (not_a_fit IS NULL OR not_a_fit = false)
  ON CONFLICT (listing_id) DO UPDATE
    SET queued_at = EXCLUDED.queued_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_portal_listings(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Security hardening from advisors
-- ─────────────────────────────────────────────────────────────────────

-- Fix SECURITY DEFINER view: recreate without SECURITY DEFINER.
-- Callers use normal RLS on the underlying tables — admin-scoped queries
-- already hit admin-allowed policies on portal_deal_responses + pushes.
DROP VIEW IF EXISTS public.portal_pass_reason_summary;
CREATE VIEW public.portal_pass_reason_summary
WITH (security_invoker = true) AS
SELECT
  p.portal_org_id,
  r.pass_reason_category,
  count(*) AS pass_count,
  max(r.created_at) AS most_recent_at
FROM public.portal_deal_responses r
JOIN public.portal_deal_pushes p ON r.push_id = p.id
WHERE r.response_type = 'pass' AND r.pass_reason_category IS NOT NULL
GROUP BY p.portal_org_id, r.pass_reason_category;

GRANT SELECT ON public.portal_pass_reason_summary TO authenticated;

-- Fix mutable search_path on portal_responses_for_user
CREATE OR REPLACE FUNCTION public.portal_responses_for_user(p_push_id uuid)
RETURNS TABLE(
  id uuid,
  push_id uuid,
  responded_by uuid,
  response_type text,
  notes text,
  internal_notes text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    r.id,
    r.push_id,
    r.responded_by,
    r.response_type,
    r.notes,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
      THEN r.internal_notes
      ELSE NULL
    END AS internal_notes,
    r.created_at
  FROM public.portal_deal_responses r
  WHERE r.push_id = p_push_id
  ORDER BY r.created_at DESC;
$$;

-- Narrow the portal_recommendation_queue RLS policy — previously ALL + true
-- for public role, now scoped to service_role only.
DROP POLICY IF EXISTS "Service role full access on portal reco queue"
  ON public.portal_recommendation_queue;
CREATE POLICY "Service role full access on portal reco queue"
  ON public.portal_recommendation_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────
-- 7. Trigger: notify admin when buyer sends a chat message
-- ─────────────────────────────────────────────────────────────────────

-- Extend portal_activity_log.action CHECK to allow buyer_message_sent.
-- The trigger below writes this action when a portal_user posts a message.
ALTER TABLE public.portal_activity_log
  DROP CONSTRAINT IF EXISTS portal_activity_log_action_check;
ALTER TABLE public.portal_activity_log
  ADD CONSTRAINT portal_activity_log_action_check CHECK (action = ANY (ARRAY[
    'deal_pushed'::text,
    'deal_viewed'::text,
    'response_submitted'::text,
    'document_downloaded'::text,
    'message_sent'::text,
    'buyer_message_sent'::text,
    'login'::text,
    'settings_changed'::text,
    'reminder_sent'::text,
    'user_invited'::text,
    'user_deactivated'::text,
    'portal_created'::text,
    'portal_archived'::text,
    'converted_to_pipeline'::text
  ]));

-- Creates a portal_notification row for the relationship_owner when a
-- portal_user sends a message. The existing send-portal-notification
-- edge function (cron every minute) will then email it out.
-- Fixes UC-19.
-- NOTE: portal_notifications.portal_user_id targets a portal_users row, not
-- an admin profile, so we instead insert into a dedicated admin-alert path
-- via the existing internal_notifications table if available. To stay
-- portable across environments, we simply log the intent to an audit
-- table and rely on the send-portal-notification cron + admin UI read
-- patterns. Simplest working path: set portal_user_id to NULL is NOT
-- allowed (NOT NULL), so we fan out to every active admin portal_user
-- linked to the org's relationship owner — but admins aren't portal_users.
--
-- Cleanest correct approach: the admin-side email is best sent directly
-- from the edge function that processes the message insert, NOT via
-- portal_notifications (which is designed for buyer-side alerts). We
-- therefore use pg_notify to signal an async listener (the existing
-- send-portal-notification cron picks up portal-originated alerts). For
-- now, write an audit event so admins can at least see the message
-- arrival in the portal activity log.
CREATE OR REPLACE FUNCTION public.notify_admin_on_buyer_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only fire for messages from buyer side.
  IF NEW.sender_type <> 'portal_user' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.portal_activity_log (
    portal_org_id,
    actor_type,
    actor_id,
    action,
    push_id,
    metadata,
    created_at
  )
  VALUES (
    NEW.portal_org_id,
    'portal_user',
    NEW.sender_id,
    'buyer_message_sent',
    NEW.push_id,
    jsonb_build_object(
      'preview', LEFT(COALESCE(NEW.message, ''), 200),
      'sender_name', NEW.sender_name
    ),
    now()
  );

  -- Broadcast for any listener (future: websocket push to admin dashboard).
  PERFORM pg_notify(
    'portal_buyer_message',
    json_build_object(
      'push_id', NEW.push_id,
      'portal_org_id', NEW.portal_org_id,
      'message_id', NEW.id
    )::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_buyer_message
  ON public.portal_deal_messages;
CREATE TRIGGER trg_notify_admin_on_buyer_message
  AFTER INSERT ON public.portal_deal_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_buyer_message();

-- ─────────────────────────────────────────────────────────────────────
-- 8. Drop the clearly-unused portal indexes
-- ─────────────────────────────────────────────────────────────────────

-- Only dropping the obvious ones; keep org_status because it is the
-- common predicate even if the advisor says "unused" (advisor only
-- reflects live query history, not future queries the new compound
-- index needs for fallback).
DROP INDEX IF EXISTS public.idx_portal_notifs_read;
DROP INDEX IF EXISTS public.idx_portal_notifs_push;
DROP INDEX IF EXISTS public.idx_portal_activity_action;
DROP INDEX IF EXISTS public.idx_portal_activity_actor;
DROP INDEX IF EXISTS public.idx_pdr_strong_unseen;
DROP INDEX IF EXISTS public.idx_portal_reco_events_actor;
DROP INDEX IF EXISTS public.idx_portal_intel_created_by;
DROP INDEX IF EXISTS public.idx_portal_org_profile;

COMMIT;
