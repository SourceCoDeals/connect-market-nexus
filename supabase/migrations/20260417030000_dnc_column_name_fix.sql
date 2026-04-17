-- =============================================================================
-- Fix DNC column name (do_not_contact → do_not_call) across the contact
-- consolidation + DNC propagation migrations shipped in PR #725.
-- =============================================================================
-- The prior three migrations (130000, 150000) assumed the column was
-- `contacts.do_not_contact` — the canonical name is `contacts.do_not_call`.
-- 130000 applied to prod with a typo (UPDATE against a phantom column); it
-- only failed at runtime when a caller tried to use that key. 150000 failed
-- at migration time because the trigger WHEN clause referenced the phantom
-- column. Both were patched directly in prod via fix migrations; this file
-- captures the corrected state so future schema-from-scratch deploys match.
--
-- This migration is idempotent against prod (CREATE OR REPLACE).
-- =============================================================================

-- ── 1. contacts_apply_webhook_flags: accept both names, write do_not_call ──
CREATE OR REPLACE FUNCTION public.contacts_apply_webhook_flags(
  p_contact_id UUID,
  p_updates JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_keys TEXT[] := ARRAY[
    'do_not_call',
    'do_not_contact',   -- accepted as a legacy alias for do_not_call
    'phone_invalid',
    'updated_at'
  ];
  k TEXT;
  v_do_not_call BOOLEAN;
  v_phone_invalid BOOLEAN;
  v_touch_updated BOOLEAN := FALSE;
BEGIN
  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'contacts_apply_webhook_flags: p_contact_id is required';
  END IF;

  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' THEN
    RAISE EXCEPTION 'contacts_apply_webhook_flags: p_updates must be a JSON object';
  END IF;

  FOR k IN SELECT * FROM jsonb_object_keys(p_updates) LOOP
    IF NOT (k = ANY(allowed_keys)) THEN
      RAISE EXCEPTION 'contacts_apply_webhook_flags: key % is not in the webhook whitelist', k;
    END IF;
  END LOOP;

  IF p_updates ? 'do_not_call' THEN
    v_do_not_call := (p_updates ->> 'do_not_call')::boolean;
  ELSIF p_updates ? 'do_not_contact' THEN
    v_do_not_call := (p_updates ->> 'do_not_contact')::boolean;
  END IF;
  IF p_updates ? 'phone_invalid' THEN
    v_phone_invalid := (p_updates ->> 'phone_invalid')::boolean;
  END IF;
  IF p_updates ? 'updated_at' THEN
    v_touch_updated := TRUE;
  END IF;

  UPDATE contacts
    SET
      do_not_call = CASE WHEN p_updates ? 'do_not_call' OR p_updates ? 'do_not_contact'
                         THEN v_do_not_call
                         ELSE do_not_call END,
      phone_invalid = CASE WHEN p_updates ? 'phone_invalid'
                           THEN v_phone_invalid
                           ELSE phone_invalid END,
      updated_at = CASE WHEN v_touch_updated THEN now() ELSE updated_at END
    WHERE id = p_contact_id;
END;
$$;

COMMENT ON FUNCTION public.contacts_apply_webhook_flags(UUID, JSONB) IS
  'Webhook-safe narrow updater for contacts flag columns (do_not_call, phone_invalid, updated_at). Accepts the legacy do_not_contact key as an alias. Rejects any JSON key not in the whitelist.';


-- ── 2. DNC propagation trigger: watch do_not_call, not do_not_contact ─────
CREATE OR REPLACE FUNCTION public.trg_contact_dnc_propagate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.do_not_call = TRUE
     AND (OLD.do_not_call IS DISTINCT FROM TRUE) THEN
    BEGIN
      PERFORM public.propagate_dnc_local(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'propagate_dnc_local failed for % — %', NEW.id, SQLERRM;
    END;

    BEGIN
      INSERT INTO dnc_propagation_queue (contact_id, contact_email, linkedin_url)
      VALUES (NEW.id, NEW.email, NEW.linkedin_url);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'dnc_propagation_queue insert failed for % — %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_dnc_propagate ON public.contacts;
CREATE TRIGGER contacts_dnc_propagate
  AFTER UPDATE OF do_not_call ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_contact_dnc_propagate();

COMMENT ON TRIGGER contacts_dnc_propagate ON public.contacts IS
  'When a contact is marked do_not_call=true, mirror to local tracking tables and queue upstream integration pauses.';
