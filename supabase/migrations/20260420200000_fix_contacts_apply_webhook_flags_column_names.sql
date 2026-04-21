-- ============================================================================
-- MIGRATION: Fix contacts_apply_webhook_flags to use real column names
-- ============================================================================
-- contacts_apply_webhook_flags (shipped by 20260416130000 during the
-- 2026-04-20 sync) references `do_not_contact` and `phone_invalid` columns
-- on public.contacts. Those columns DO NOT exist in prod — the real columns
-- are `do_not_call` and `phone_number_invalid`.
--
-- The RPC therefore fails every time it's called with either of those
-- fields in the webhook payload. Caught during the 2026-04-20 post-sync
-- platform audit.
--
-- Resolution is the same as the DNC trigger case (see
-- 20260416150000_dnc_propagation_trigger.sql rewrite): fix the code to
-- match prod reality rather than rename the prod column. 6+ callsites
-- across phoneburner / smartlead / heyreach edge functions already lean
-- toward `do_not_call`; unifying on that name is the cheaper path.
-- ============================================================================

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
  -- caller to use a dedicated RPC for broader updates.
  allowed_keys TEXT[] := ARRAY[
    'do_not_call',
    'phone_number_invalid',
    'updated_at'
  ];
  k TEXT;
  v_do_not_call         BOOLEAN;
  v_phone_number_invalid BOOLEAN;
  v_touch_updated       BOOLEAN := FALSE;
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
  END IF;
  IF p_updates ? 'phone_number_invalid' THEN
    v_phone_number_invalid := (p_updates ->> 'phone_number_invalid')::boolean;
  END IF;
  IF p_updates ? 'updated_at' THEN
    v_touch_updated := TRUE;
  END IF;

  -- Single UPDATE. Using CASE WHEN ... THEN <new> ELSE <col> END so unspecified
  -- keys preserve their current values without needing a separate branch.
  UPDATE contacts
    SET
      do_not_call          = CASE WHEN p_updates ? 'do_not_call'
                                  THEN v_do_not_call
                                  ELSE do_not_call END,
      phone_number_invalid = CASE WHEN p_updates ? 'phone_number_invalid'
                                  THEN v_phone_number_invalid
                                  ELSE phone_number_invalid END,
      updated_at           = CASE WHEN v_touch_updated THEN now() ELSE updated_at END
    WHERE id = p_contact_id;
END;
$$;

COMMENT ON FUNCTION public.contacts_apply_webhook_flags(UUID, JSONB) IS
  'Webhook-safe narrow updater for contacts flag columns (do_not_call, '
  'phone_number_invalid, updated_at). Rejects any JSON key not in the '
  'whitelist. Use this from edge-function webhooks instead of a direct '
  'UPDATE so the contact consolidation lint stays satisfied and flag-write '
  'surface area is tracked in one place.';

GRANT EXECUTE ON FUNCTION public.contacts_apply_webhook_flags(UUID, JSONB)
  TO authenticated, service_role;
