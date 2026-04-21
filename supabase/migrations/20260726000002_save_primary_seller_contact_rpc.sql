-- ============================================================================
-- MIGRATION: save_primary_seller_contact RPC
-- ============================================================================
-- The Remarketing deal-detail "Edit Primary Contact" modal lets admins enter
-- up to three phone numbers (primary + two additional). Previously the save
-- path:
--
--   1. Updated listings.main_contact_* (fires trg_sync_listing_to_contacts)
--   2. SELECTed contacts WHERE is_primary_seller_contact = true
--   3. Direct UPDATE of mobile_phone_1/2/3 on that row
--
-- Each step had a failure mode that silently dropped the additional phones:
--
--   * Step 2's filter misses seller contacts whose is_primary_seller_contact
--     was never set to true. The sync trigger only sets the flag on NEW
--     inserts, and its INSERT is gated by ON CONFLICT DO NOTHING — so a
--     pre-existing seller contact (e.g. created by a CSV import or
--     enrichment) stays un-flagged forever.
--   * Step 3's direct UPDATE runs as the authenticated role, which has had
--     INSERT/UPDATE on contacts REVOKEd since 20260625000008. The write
--     fails with permission denied and the whole mutation throws.
--   * When step 2 returned null, the `if (contact?.id)` guard in the client
--     silently skipped step 3 with no user feedback.
--
-- This RPC collapses all of the above into one SECURITY DEFINER call:
--
--   * Finds the seller contact for a listing, preferring the flagged primary
--     but falling back to the oldest non-archived seller contact.
--   * If no seller contact exists, inserts one (name split into first/last).
--   * Sets is_primary_seller_contact = true so future reads/writes are stable.
--   * Writes mobile_phone_1/2/3 with explicit-clear semantics: passing an
--     empty string clears the field, passing NULL keeps the existing value.
--   * Keeps the legacy `phone` column in sync with mobile_phone_1 so any
--     reader that still uses `phone` sees the latest primary.
--
-- Returns the contacts.id so the caller can invalidate related query caches.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_primary_seller_contact(
  p_listing_id      UUID,
  p_name            TEXT,
  p_email           TEXT,
  p_phone           TEXT,
  p_mobile_phone_2  TEXT DEFAULT NULL,
  p_mobile_phone_3  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_contact_id UUID;
  v_first_name TEXT;
  v_last_name  TEXT;
  v_trimmed_name TEXT := NULLIF(TRIM(p_name), '');
  v_trimmed_email TEXT := NULLIF(TRIM(lower(p_email)), '');
BEGIN
  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'save_primary_seller_contact: p_listing_id is required';
  END IF;

  -- 1. Find an existing seller contact for this listing. Prefer the one
  --    flagged as primary; otherwise fall back to the oldest non-archived
  --    seller contact so we don't create a duplicate when the sync trigger's
  --    ON CONFLICT DO NOTHING left the flag un-set.
  SELECT id
  INTO v_contact_id
  FROM public.contacts
  WHERE listing_id = p_listing_id
    AND contact_type = 'seller'
    AND archived = false
  ORDER BY is_primary_seller_contact DESC, created_at ASC
  LIMIT 1;

  -- 2a. Create the contact if none exists yet. Split the name on the first
  --     whitespace; if the name is empty, fall back to 'Unknown'.
  IF v_contact_id IS NULL THEN
    v_first_name := COALESCE(
      NULLIF(TRIM(split_part(COALESCE(v_trimmed_name, ''), ' ', 1)), ''),
      'Unknown'
    );
    v_last_name := CASE
      WHEN v_trimmed_name IS NOT NULL AND position(' ' IN v_trimmed_name) > 0
      THEN TRIM(substring(v_trimmed_name FROM position(' ' IN v_trimmed_name) + 1))
      ELSE ''
    END;

    INSERT INTO public.contacts (
      first_name, last_name, email, phone,
      contact_type, listing_id, is_primary_seller_contact,
      mobile_phone_1, mobile_phone_2, mobile_phone_3,
      phone_source, source
    ) VALUES (
      v_first_name,
      v_last_name,
      v_trimmed_email,
      NULLIF(TRIM(p_phone), ''),
      'seller',
      p_listing_id,
      true,
      NULLIF(TRIM(p_phone), ''),
      NULLIF(TRIM(p_mobile_phone_2), ''),
      NULLIF(TRIM(p_mobile_phone_3), ''),
      'manual',
      'deal_detail_edit'
    )
    RETURNING id INTO v_contact_id;

  -- 2b. Otherwise update the existing contact. CASE WHEN distinguishes
  --     NULL (keep existing) from '' (explicit clear) so the UI can remove
  --     a phone number by clearing the input.
  ELSE
    UPDATE public.contacts
    SET
      first_name = CASE
        WHEN v_trimmed_name IS NOT NULL
        THEN COALESCE(NULLIF(TRIM(split_part(v_trimmed_name, ' ', 1)), ''), first_name)
        ELSE first_name
      END,
      last_name = CASE
        WHEN v_trimmed_name IS NOT NULL AND position(' ' IN v_trimmed_name) > 0
        THEN TRIM(substring(v_trimmed_name FROM position(' ' IN v_trimmed_name) + 1))
        WHEN v_trimmed_name IS NOT NULL
        THEN ''
        ELSE last_name
      END,
      email = CASE
        WHEN p_email IS NOT NULL THEN v_trimmed_email
        ELSE email
      END,
      phone = CASE
        WHEN p_phone IS NOT NULL THEN NULLIF(TRIM(p_phone), '')
        ELSE phone
      END,
      mobile_phone_1 = CASE
        WHEN p_phone IS NOT NULL THEN NULLIF(TRIM(p_phone), '')
        ELSE mobile_phone_1
      END,
      mobile_phone_2 = CASE
        WHEN p_mobile_phone_2 IS NOT NULL THEN NULLIF(TRIM(p_mobile_phone_2), '')
        ELSE mobile_phone_2
      END,
      mobile_phone_3 = CASE
        WHEN p_mobile_phone_3 IS NOT NULL THEN NULLIF(TRIM(p_mobile_phone_3), '')
        ELSE mobile_phone_3
      END,
      is_primary_seller_contact = true,
      phone_source = 'manual',
      updated_at = now()
    WHERE id = v_contact_id;
  END IF;

  RETURN v_contact_id;
END;
$$;

COMMENT ON FUNCTION public.save_primary_seller_contact(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Upserts the primary seller contact for a listing and writes mobile_phone_1/2/3 '
  'in a single SECURITY DEFINER call. Sets is_primary_seller_contact=true so '
  'future reads resolve the same row. Pass NULL to keep a phone, '''' to clear it.';

GRANT EXECUTE ON FUNCTION public.save_primary_seller_contact(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated, service_role;
