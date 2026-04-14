-- =============================================================================
-- Outlook Sync Performance: move email_messages → deal_activities logging
-- from a per-row `log_deal_activity` RPC call in the edge function into an
-- AFTER INSERT trigger on `email_messages`.
--
-- Context:
--   The historical backfill engine (`outlook-sync-emails`) used to await one
--   `supabase.rpc('log_deal_activity', ...)` round-trip inside its matched-
--   email insert loop, which was the single largest contributor to its
--   per-message latency. A 100-message Graph page with moderate
--   contact-match rates easily generated 50+ sequential blocking RPCs.
--
--   Moving the activity insert into a trigger has three wins:
--     1. The sync engine no longer makes a per-row await — it only does
--        bulk upserts against `email_messages` / `outlook_unmatched_emails`.
--     2. The activity row lands in the same transaction as the email row,
--        so there's no possibility of an `email_messages` insert "succeeding"
--        without the matching timeline entry (the old RPC catch-and-swallow
--        left inconsistent state on failure).
--     3. Any *future* insert path into `email_messages` (retro-link from
--        `rematch_unmatched_outlook_emails`, manual promote, scheduled
--        worker, etc.) gets timeline coverage for free — we no longer have
--        to remember to log activities at every call site.
--
-- Safety:
--   - Trigger only fires when `NEW.deal_id IS NOT NULL` via a WHEN guard,
--     matching the edge function's previous `if (contact.deal_id)` check.
--   - Trigger ALSO skips rows whose `microsoft_message_id` starts with
--     `platform_sent_` (the placeholder id scheme used by
--     `outlook-send-email` for emails the user sends through the platform).
--     Those rows are already logged to `deal_activities` by
--     `outlook-send-email` via an explicit `log_deal_activity` RPC call, so
--     firing the trigger here too would create a duplicate timeline entry
--     for every sent email. The later "upgrade" path in `outlook-sync-emails`
--     that replaces the placeholder id with the real Graph id is an UPDATE
--     (not an INSERT), so the AFTER INSERT trigger doesn't fire for that
--     either — the single RPC call in send-email remains the sole source of
--     timeline coverage for platform-sent emails.
--   - The body wraps its INSERT in an EXCEPTION block so an activity log
--     failure cannot roll back the email row itself (matches the old RPC's
--     swallow-on-error behavior, just recorded via RAISE NOTICE).
--   - `activity_type` uses 'email_sent' / 'email_received'; both are in the
--     `deal_activities_activity_type_check` constraint set as of migration
--     20260619000000_comprehensive_workflow_automation.sql.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_email_messages_log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity_type text;
  v_title text;
  v_to_display text;
  v_direction text;
BEGIN
  -- Cast the email_direction enum to text so we can compare without
  -- hard-coding a schema-qualified type reference.
  v_direction := NEW.direction::text;

  IF v_direction = 'outbound' THEN
    v_activity_type := 'email_sent';
    v_to_display := NULLIF(array_to_string(NEW.to_addresses, ', '), '');
    v_title := format('Email sent to %s', COALESCE(left(v_to_display, 200), '(no recipients)'));
  ELSE
    v_activity_type := 'email_received';
    v_title := format('Email from %s', COALESCE(NEW.from_address, '(unknown sender)'));
  END IF;

  INSERT INTO public.deal_activities (
    deal_id,
    admin_id,
    activity_type,
    title,
    description,
    metadata
  ) VALUES (
    NEW.deal_id,
    NULL,
    v_activity_type,
    v_title,
    COALESCE(NEW.subject, '(No subject)'),
    jsonb_build_object(
      'email_message_id', NEW.microsoft_message_id,
      'direction', v_direction,
      'from_address', NEW.from_address,
      'to_addresses', NEW.to_addresses,
      'subject', NEW.subject,
      'has_attachments', NEW.has_attachments,
      'contact_id', NEW.contact_id,
      'body_preview', left(COALESCE(NEW.body_text, NEW.body_html, ''), 300)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Activity logging failures must not roll back the email insert itself
  -- (matches the pre-trigger edge-function behavior where the RPC was
  -- wrapped in a try/catch that only logged to console).
  RAISE NOTICE 'trg_email_messages_log_activity failed for email %: %',
    NEW.microsoft_message_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_messages_log_activity ON public.email_messages;
CREATE TRIGGER trg_email_messages_log_activity
  AFTER INSERT ON public.email_messages
  FOR EACH ROW
  WHEN (
    NEW.deal_id IS NOT NULL
    AND NEW.microsoft_message_id NOT LIKE 'platform_sent\_%' ESCAPE '\'
  )
  EXECUTE FUNCTION public.trg_email_messages_log_activity();

-- Execute permission: the trigger runs as SECURITY DEFINER so it doesn't
-- need an explicit GRANT to the sync role, but granting to service_role
-- keeps behavior explicit if we ever want to call it manually from an edge
-- function for backfilling historical rows.
GRANT EXECUTE ON FUNCTION public.trg_email_messages_log_activity() TO service_role;
