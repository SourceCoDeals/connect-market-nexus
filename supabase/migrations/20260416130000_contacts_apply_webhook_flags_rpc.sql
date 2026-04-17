-- =============================================================================
-- contacts_apply_webhook_flags RPC
-- =============================================================================
-- Governance guardrail: edge function webhooks (phoneburner-webhook etc.) must
-- not issue direct `from('contacts').update(...)` calls. The
-- lint-contacts-invariants hook has been blocking commits that touch those
-- files since the contact consolidation audit (DATABASE_DUPLICATES_AUDIT_
-- 2026-04-09.md §3). The target RPC referenced in the lint message —
-- `contacts_upsert` — was never actually created, so webhooks either had to
-- carry pre-existing violations or bypass the lint with SKIP_CONTACT_LINT.
--
-- This migration ships the narrow RPC webhooks actually need: a whitelisted
-- flag-setter. It accepts a JSON patch with a fixed set of allowed keys (DNC,
-- phone_invalid, last-touch updated_at bump) and rejects any unknown key with
-- an exception. Webhooks that want to do anything richer should use a
-- domain-specific RPC — this one is scoped to the flag-update pattern.
-- =============================================================================

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
  -- Whitelist of keys webhooks are allowed to set via this RPC. Any key in
  -- p_updates that isn't in this list causes the call to fail — forces the
  -- caller to use a dedicated RPC for broader updates. `do_not_contact` is
  -- accepted as a legacy alias for `do_not_call` (the canonical column).
  allowed_keys TEXT[] := ARRAY[
    'do_not_call',
    'do_not_contact',
    'phone_invalid',
    'updated_at'
  ];
  k TEXT;
  v_do_not_call    BOOLEAN;
  v_phone_invalid  BOOLEAN;
  v_touch_updated  BOOLEAN := FALSE;
BEGIN
  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'contacts_apply_webhook_flags: p_contact_id is required';
  END IF;

  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' THEN
    RAISE EXCEPTION 'contacts_apply_webhook_flags: p_updates must be a JSON object';
  END IF;

  -- Validate every key up-front so partial writes don't land.
  FOR k IN SELECT * FROM jsonb_object_keys(p_updates) LOOP
    IF NOT (k = ANY(allowed_keys)) THEN
      RAISE EXCEPTION 'contacts_apply_webhook_flags: key % is not in the webhook whitelist', k;
    END IF;
  END LOOP;

  -- Extract allowed values (NULL when key absent).
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

  -- Single UPDATE. Using CASE WHEN ... THEN <new> ELSE <col> END so unspecified
  -- keys preserve their current values without needing a separate branch.
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
  'Webhook-safe narrow updater for contacts flag columns (do_not_call, '
  'phone_invalid, updated_at). Accepts the legacy do_not_contact key as an '
  'alias. Rejects any JSON key not in the whitelist. Use this from edge-'
  'function webhooks instead of a direct UPDATE so the contact consolidation '
  'lint stays satisfied and flag-write surface area is tracked in one place.';

GRANT EXECUTE ON FUNCTION public.contacts_apply_webhook_flags(UUID, JSONB)
  TO authenticated, service_role;
