-- ============================================================================
-- MIGRATION: contacts soft-delete RPC + resolver archived-row exclusion
-- ============================================================================
-- The forensic audit of `public.contacts` writers (see CTO audit 2026-04-18)
-- turned up two categorically related bugs:
--
--   1. `20260625000008_revoke_direct_contacts_writes.sql` revoked
--      INSERT/UPDATE on `public.contacts` from the `authenticated` role.
--      Several UI delete paths still call `.from('contacts').update({
--      archived: true })` directly — those writes silently fail under the
--      REVOKE, the UI toast says "Contact deleted", and the row stays
--      live. Add a `contacts_soft_delete(UUID)` SECURITY DEFINER RPC so
--      the UI can delete without needing direct write access, and have
--      it stamp both the legacy `archived=true` flag AND the newer
--      `deleted_at=now()` marker. That also closes the LinkedIn-index
--      divergence where archived-but-not-deleted rows still owned the
--      unique slot in `idx_contacts_linkedin_url_unique` and blocked
--      re-adds through every non-upsert_buyer_contact writer.
--
--   2. `resolve_contact_identity` (20260625000006) filters its candidate
--      SELECTs on `deleted_at IS NULL AND merged_into_id IS NULL` but
--      not on `archived=false`. Consequently `contacts_upsert` will
--      happily "update" an archived-but-not-deleted row and return its
--      id — silently restoring a deleted contact while leaving
--      `archived=true` set, which the UI read paths still filter out. The
--      returned UUID is a zombie: visible to the writer, invisible to
--      the reader. Fix: add `archived=false` to all three resolution
--      branches, AND clear `archived=false` in the `contacts_upsert`
--      UPDATE path so an explicit re-add cleanly revives the row. The
--      LinkedIn branch in `upsert_buyer_contact` already does this; we
--      bring the canonical RPC up to parity.
-- ============================================================================


-- ─── 1. contacts_soft_delete RPC ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.contacts_soft_delete(p_contact_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'contacts_soft_delete: p_contact_id is required';
  END IF;

  -- Admin gate. The direct UI write path was previously authorized by the
  -- `contacts_admin_all` RLS policy — this RPC replaces that authorization
  -- with an explicit is_admin check since SECURITY DEFINER bypasses RLS.
  SELECT public.is_admin(auth.uid()) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Access denied: admin role required to soft-delete contacts'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.contacts
  SET
    -- Set BOTH the legacy archived flag and the canonical deleted_at.
    -- Readers filter on archived; unique indexes filter on deleted_at.
    -- Setting both ensures the row disappears from every lookup surface.
    archived   = true,
    deleted_at = COALESCE(deleted_at, now()),
    updated_at = now()
  WHERE id = p_contact_id;

  RETURN p_contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.contacts_soft_delete(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contacts_soft_delete(UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.contacts_soft_delete(UUID) IS
  'Soft-deletes a contact by setting archived=true AND deleted_at=now(). '
  'Admin-gated. Replaces the UI-side direct UPDATE that broke silently '
  'after 20260625000008 revoked authenticated writes.';


-- ─── 2. resolve_contact_identity — exclude archived rows ──────────────────

CREATE OR REPLACE FUNCTION public.resolve_contact_identity(
  p_email         TEXT DEFAULT NULL,
  p_linkedin_url  TEXT DEFAULT NULL,
  p_phone         TEXT DEFAULT NULL,
  p_firm_id       UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  -- 1. email match
  IF p_email IS NOT NULL AND trim(p_email) <> '' THEN
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE lower(email) = lower(trim(p_email))
      AND deleted_at IS NULL
      AND merged_into_id IS NULL
      AND archived = false
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_contact_id IS NOT NULL THEN
      RETURN v_contact_id;
    END IF;
  END IF;

  -- 2. linkedin_url match
  IF p_linkedin_url IS NOT NULL AND trim(p_linkedin_url) <> '' THEN
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE lower(linkedin_url) = lower(trim(p_linkedin_url))
      AND deleted_at IS NULL
      AND merged_into_id IS NULL
      AND archived = false
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_contact_id IS NOT NULL THEN
      RETURN v_contact_id;
    END IF;
  END IF;

  -- 3. phone + firm_id tuple
  IF p_phone IS NOT NULL AND trim(p_phone) <> '' AND p_firm_id IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE lower(phone) = lower(trim(p_phone))
      AND firm_id = p_firm_id
      AND deleted_at IS NULL
      AND merged_into_id IS NULL
      AND archived = false
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_contact_id IS NOT NULL THEN
      RETURN v_contact_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;


-- ─── 3. contacts_upsert — clear archived on explicit re-add ───────────────
--
-- When a caller runs `contacts_upsert` with an identity that matches an
-- archived row (only possible now via the LinkedIn/email/phone branches
-- post-fix-#2 above, but `contact_type` resolution may still land on a
-- row that happened to be archived via a different matching key), we
-- want the re-add to revive the row cleanly. The UPDATE path now clears
-- `archived=false` (and does NOT touch deleted_at since the row was live
-- before archival). Without this, `contacts_upsert` returns an id for a
-- row the UI still hides.
--
-- We only modify the UPDATE branch of contacts_upsert; the INSERT and
-- identity resolution logic stays identical. This is a minimal-surface
-- change to avoid re-owning all of the 300-line upsert body.

CREATE OR REPLACE FUNCTION public.contacts_upsert(
  p_identity   JSONB,
  p_fields     JSONB,
  p_source     TEXT DEFAULT 'manual',
  p_enrichment JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_contact_id   UUID;
  v_existing     public.contacts%ROWTYPE;
  v_new_row      public.contacts%ROWTYPE;
  v_event_type   TEXT;
  v_is_insert    BOOLEAN;
  v_old_json     JSONB;
  v_new_json     JSONB;
  v_changed      TEXT[];
BEGIN
  v_contact_id := public.resolve_contact_identity(
    (p_identity->>'email')::TEXT,
    (p_identity->>'linkedin_url')::TEXT,
    (p_identity->>'phone')::TEXT,
    NULLIF((p_identity->>'firm_id')::TEXT, '')::UUID
  );

  v_is_insert := v_contact_id IS NULL;

  IF v_is_insert AND (p_fields ? 'email' OR p_fields ? 'linkedin_url') THEN
    v_contact_id := public.resolve_contact_identity(
      (p_fields->>'email')::TEXT,
      (p_fields->>'linkedin_url')::TEXT,
      (p_fields->>'phone')::TEXT,
      NULLIF((p_fields->>'firm_id')::TEXT, '')::UUID
    );
    v_is_insert := v_contact_id IS NULL;
  END IF;

  IF NOT v_is_insert THEN
    SELECT * INTO v_existing FROM public.contacts WHERE id = v_contact_id;
    v_old_json := to_jsonb(v_existing);
  END IF;

  IF v_is_insert THEN
    IF COALESCE(p_fields->>'first_name', '') = '' THEN
      RAISE EXCEPTION 'contacts_upsert: first_name is required for new contacts';
    END IF;

    IF COALESCE(p_fields->>'email', '') = ''
       AND COALESCE(p_fields->>'linkedin_url', '') = '' THEN
      RAISE EXCEPTION 'contacts_upsert: new contacts require at least one of email or linkedin_url';
    END IF;

    INSERT INTO public.contacts (
      first_name, last_name, email, phone, linkedin_url, title,
      contact_type, firm_id, remarketing_buyer_id, profile_id, listing_id,
      is_primary_at_firm, is_primary_seller_contact,
      nda_signed, nda_signed_at, fee_agreement_signed, fee_agreement_signed_at,
      confidence, last_enriched_at, last_enrichment_source,
      role_category, priority_level,
      source, notes
    ) VALUES (
      COALESCE(p_fields->>'first_name', 'Unknown'),
      COALESCE(p_fields->>'last_name', ''),
      NULLIF(lower(trim(p_fields->>'email')), ''),
      NULLIF(trim(p_fields->>'phone'), ''),
      NULLIF(trim(p_fields->>'linkedin_url'), ''),
      NULLIF(trim(p_fields->>'title'), ''),
      COALESCE(p_fields->>'contact_type', 'buyer'),
      NULLIF(p_fields->>'firm_id', '')::UUID,
      NULLIF(p_fields->>'remarketing_buyer_id', '')::UUID,
      NULLIF(p_fields->>'profile_id', '')::UUID,
      NULLIF(p_fields->>'listing_id', '')::UUID,
      COALESCE((p_fields->>'is_primary_at_firm')::BOOLEAN, false),
      COALESCE((p_fields->>'is_primary_seller_contact')::BOOLEAN, false),
      COALESCE((p_fields->>'nda_signed')::BOOLEAN, false),
      (p_fields->>'nda_signed_at')::TIMESTAMPTZ,
      COALESCE((p_fields->>'fee_agreement_signed')::BOOLEAN, false),
      (p_fields->>'fee_agreement_signed_at')::TIMESTAMPTZ,
      CASE
        WHEN p_enrichment IS NOT NULL THEN COALESCE(p_enrichment->>'confidence', 'unverified')
        ELSE COALESCE(p_fields->>'confidence', 'unverified')
      END,
      CASE WHEN p_enrichment IS NOT NULL THEN now() ELSE NULL END,
      CASE WHEN p_enrichment IS NOT NULL THEN p_enrichment->>'provider' ELSE NULL END,
      NULLIF(p_fields->>'role_category', ''),
      NULLIF((p_fields->>'priority_level')::SMALLINT, 0),
      p_source,
      NULLIF(p_fields->>'notes', '')
    )
    RETURNING id INTO v_contact_id;

    v_event_type := CASE WHEN p_enrichment IS NOT NULL THEN 'enrichment' ELSE 'create' END;

  ELSE
    UPDATE public.contacts
    SET
      first_name   = COALESCE(NULLIF(p_fields->>'first_name', ''),   first_name),
      last_name    = COALESCE(NULLIF(p_fields->>'last_name', ''),    last_name),
      email        = COALESCE(NULLIF(lower(trim(p_fields->>'email')), ''), email),
      phone        = COALESCE(NULLIF(trim(p_fields->>'phone'), ''),  phone),
      linkedin_url = COALESCE(NULLIF(trim(p_fields->>'linkedin_url'), ''), linkedin_url),
      title        = COALESCE(NULLIF(trim(p_fields->>'title'), ''),  title),
      firm_id      = COALESCE(NULLIF(p_fields->>'firm_id', '')::UUID, firm_id),
      remarketing_buyer_id = COALESCE(NULLIF(p_fields->>'remarketing_buyer_id', '')::UUID, remarketing_buyer_id),
      profile_id   = COALESCE(NULLIF(p_fields->>'profile_id', '')::UUID, profile_id),
      listing_id   = COALESCE(NULLIF(p_fields->>'listing_id', '')::UUID, listing_id),
      contact_type = COALESCE(NULLIF(p_fields->>'contact_type', ''), contact_type),
      role_category   = COALESCE(NULLIF(p_fields->>'role_category', ''), role_category),
      priority_level  = COALESCE(NULLIF((p_fields->>'priority_level')::SMALLINT, 0), priority_level),
      notes        = COALESCE(NULLIF(p_fields->>'notes', ''), notes),
      confidence   = CASE
        WHEN p_enrichment IS NOT NULL THEN COALESCE(p_enrichment->>'confidence', confidence)
        ELSE confidence
      END,
      last_enriched_at = CASE
        WHEN p_enrichment IS NOT NULL THEN now()
        ELSE last_enriched_at
      END,
      last_enrichment_source = CASE
        WHEN p_enrichment IS NOT NULL THEN p_enrichment->>'provider'
        ELSE last_enrichment_source
      END,
      -- Revive an archived row on explicit re-add. We only land here when
      -- resolve_contact_identity returned a row (post-fix #2 above, that
      -- means archived=false) — but legacy rows with archived=true AND
      -- deleted_at IS NULL could have been resolved BEFORE fix #2
      -- applied, in which case contacts_upsert's caller wants a live
      -- row. Clearing archived here is a no-op for already-live rows
      -- and a repair for the legacy edge case.
      archived     = false,
      updated_at = now()
    WHERE id = v_contact_id;

    v_event_type := CASE WHEN p_enrichment IS NOT NULL THEN 'enrichment' ELSE 'update' END;
  END IF;

  SELECT * INTO v_new_row FROM public.contacts WHERE id = v_contact_id;
  v_new_json := to_jsonb(v_new_row);

  IF v_old_json IS NOT NULL THEN
    SELECT array_agg(key)
    INTO v_changed
    FROM jsonb_object_keys(v_new_json) AS key
    WHERE v_old_json->key IS DISTINCT FROM v_new_json->key;
  END IF;

  INSERT INTO public.contact_events (
    contact_id,
    event_type,
    provider,
    confidence,
    source_query,
    old_values,
    new_values,
    changed_fields,
    performed_by,
    performed_at
  )
  VALUES (
    v_contact_id,
    v_event_type,
    COALESCE(p_enrichment->>'provider', p_source),
    p_enrichment->>'confidence',
    p_enrichment->>'source_query',
    v_old_json,
    v_new_json,
    v_changed,
    auth.uid(),
    now()
  );

  RETURN v_contact_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.contacts_upsert(JSONB, JSONB, TEXT, JSONB)
  TO authenticated, service_role;
