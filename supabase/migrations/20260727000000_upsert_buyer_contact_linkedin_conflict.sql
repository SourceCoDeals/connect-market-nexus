-- ============================================================================
-- MIGRATION: upsert_buyer_contact — handle idx_contacts_linkedin_url_unique
--            and drop the stale 10-arg overload left behind in 20260613000000
-- ============================================================================
-- Problem
-- -------
-- The Remarketing Buyer Detail "Add Contact" dialog (and the parallel
-- PE Firm Detail variant) call public.upsert_buyer_contact, which INSERTs
-- into public.contacts with an ON CONFLICT clause that only handles the
-- email / name-based unique indexes:
--
--   * idx_contacts_buyer_email_unique       (lower(email))
--   * idx_contacts_buyer_name_rmkt_unique   (name + remarketing_buyer_id)
--   * idx_contacts_buyer_name_only_unique   (name, no buyer)
--
-- Commit 20260625000004 added a FOURTH partial-unique index that the RPC
-- never learned about:
--
--   CREATE UNIQUE INDEX idx_contacts_linkedin_url_unique
--     ON public.contacts(lower(linkedin_url))
--     WHERE linkedin_url IS NOT NULL
--       AND linkedin_url <> ''
--       AND deleted_at IS NULL
--       AND merged_into_id IS NULL;
--
-- When an admin fills the "Add Contact" form with a LinkedIn URL that any
-- live contact already owns (typically because auto-discovery / Prospeo /
-- Clay enriched that person first), the INSERT hits the LinkedIn index,
-- the email-based ON CONFLICT never matches, and Postgres raises
-- `duplicate key value violates unique constraint
-- "idx_contacts_linkedin_url_unique"`. The UI swallowed the error as a
-- generic "Failed to add contact" toast, masking the root cause for weeks.
--
-- Fix strategy
-- ------------
-- Before running the INSERT, try to resolve an existing live contact by
-- lower(linkedin_url). If one exists, UPDATE it in place (same shape as
-- the UPDATE branches the function already ships with, plus firm_id and
-- remarketing_buyer_id linkage for cases where the pre-existing row was
-- created bare by enrichment). Only fall through to the INSERT path when
-- no LinkedIn match exists.
--
-- Other identities (email, name) keep their original resolution paths —
-- email is still stronger than LinkedIn when both are present and the
-- caller expects an email-keyed upsert.
--
-- Ordering — why LinkedIn is checked BEFORE the email branch:
-- The email branch's ON CONFLICT only matches idx_contacts_buyer_email_unique.
-- If a LinkedIn-only row already exists for this person (no email yet),
-- and the caller now supplies both email + linkedin_url, the email branch
-- would INSERT a new row that collides with the LinkedIn index. Checking
-- LinkedIn first collapses those two rows into an UPDATE of the existing
-- LinkedIn row, picking up the new email at the same time.
--
-- The LinkedIn match filter mirrors the unique index predicate exactly
-- (deleted_at IS NULL, merged_into_id IS NULL) so we never resolve onto
-- a tombstone that the index itself has released.
-- ============================================================================

-- The 20260613000000 migration created a 10-arg upsert_buyer_contact.
-- 20260701000002 then added a 15-arg overload via CREATE OR REPLACE — but
-- Postgres scopes overload-replacement by argument list, so the stale
-- 10-arg signature survived in parallel. Drop it so PostgREST cannot
-- accidentally resolve client calls to the older, LinkedIn-unaware body.
DROP FUNCTION IF EXISTS public.upsert_buyer_contact(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID, UUID, TEXT
);

CREATE OR REPLACE FUNCTION public.upsert_buyer_contact(
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_linkedin_url TEXT DEFAULT NULL,
  p_is_primary_at_firm BOOLEAN DEFAULT false,
  p_remarketing_buyer_id UUID DEFAULT NULL,
  p_firm_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'remarketing_manual',
  p_mobile_phone_1 TEXT DEFAULT NULL,
  p_mobile_phone_2 TEXT DEFAULT NULL,
  p_mobile_phone_3 TEXT DEFAULT NULL,
  p_office_phone TEXT DEFAULT NULL,
  p_phone_source TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := NULLIF(TRIM(lower(p_email)), '');
  v_linkedin TEXT := NULLIF(TRIM(p_linkedin_url), '');
  v_contact_id UUID;
BEGIN
  -- 0. LinkedIn resolution — check before any INSERT path runs.
  IF v_linkedin IS NOT NULL THEN
    SELECT id
    INTO v_contact_id
    FROM public.contacts
    WHERE lower(linkedin_url) = lower(v_linkedin)
      AND deleted_at IS NULL
      AND merged_into_id IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_contact_id IS NOT NULL THEN
      UPDATE public.contacts
      SET
        first_name           = COALESCE(NULLIF(TRIM(p_first_name), ''), first_name),
        last_name            = COALESCE(p_last_name, last_name),
        email                = COALESCE(email, v_email),
        phone                = COALESCE(phone, NULLIF(TRIM(p_phone), '')),
        title                = COALESCE(title, NULLIF(TRIM(p_title), '')),
        -- Linkage fields prefer the caller's values when present so an
        -- enrichment-created bare row gets attached to the buyer/firm.
        remarketing_buyer_id = COALESCE(remarketing_buyer_id, p_remarketing_buyer_id),
        firm_id              = COALESCE(firm_id, p_firm_id),
        is_primary_at_firm   = is_primary_at_firm OR p_is_primary_at_firm,
        mobile_phone_1       = COALESCE(mobile_phone_1, NULLIF(TRIM(p_mobile_phone_1), '')),
        mobile_phone_2       = COALESCE(mobile_phone_2, NULLIF(TRIM(p_mobile_phone_2), '')),
        mobile_phone_3       = COALESCE(mobile_phone_3, NULLIF(TRIM(p_mobile_phone_3), '')),
        office_phone         = COALESCE(office_phone, NULLIF(TRIM(p_office_phone), '')),
        phone_source         = COALESCE(phone_source, NULLIF(TRIM(p_phone_source), '')),
        -- Bare enrichment rows default to contact_type='buyer' already; we
        -- don't overwrite a seller/advisor/etc. row with 'buyer' just
        -- because this particular UI pushed us through here.
        contact_type         = contact_type,
        -- Archived rows with deleted_at IS NULL can exist from the old
        -- soft-delete scheme. If the user is re-adding this person, clear
        -- the archived flag so they show up on the buyer detail list again.
        archived             = false,
        updated_at           = now()
      WHERE id = v_contact_id;

      RETURN v_contact_id;
    END IF;
  END IF;

  IF v_email IS NOT NULL THEN
    -- Has email -> upsert by email
    INSERT INTO public.contacts
      (first_name, last_name, email, phone, title, linkedin_url,
       is_primary_at_firm, contact_type, remarketing_buyer_id, firm_id, source,
       mobile_phone_1, mobile_phone_2, mobile_phone_3, office_phone, phone_source)
    VALUES
      (p_first_name, p_last_name, v_email,
       NULLIF(TRIM(p_phone), ''),
       NULLIF(TRIM(p_title), ''),
       v_linkedin,
       p_is_primary_at_firm, 'buyer', p_remarketing_buyer_id, p_firm_id, p_source,
       NULLIF(TRIM(p_mobile_phone_1), ''),
       NULLIF(TRIM(p_mobile_phone_2), ''),
       NULLIF(TRIM(p_mobile_phone_3), ''),
       NULLIF(TRIM(p_office_phone), ''),
       NULLIF(TRIM(p_phone_source), ''))
    ON CONFLICT (lower(email))
      WHERE contact_type = 'buyer' AND email IS NOT NULL AND archived = false
    DO UPDATE SET
      first_name           = EXCLUDED.first_name,
      last_name            = EXCLUDED.last_name,
      remarketing_buyer_id = COALESCE(contacts.remarketing_buyer_id, EXCLUDED.remarketing_buyer_id),
      firm_id              = COALESCE(contacts.firm_id, EXCLUDED.firm_id),
      is_primary_at_firm   = contacts.is_primary_at_firm OR EXCLUDED.is_primary_at_firm,
      phone                = COALESCE(EXCLUDED.phone, contacts.phone),
      linkedin_url         = COALESCE(EXCLUDED.linkedin_url, contacts.linkedin_url),
      title                = COALESCE(EXCLUDED.title, contacts.title),
      mobile_phone_1       = COALESCE(EXCLUDED.mobile_phone_1, contacts.mobile_phone_1),
      mobile_phone_2       = COALESCE(EXCLUDED.mobile_phone_2, contacts.mobile_phone_2),
      mobile_phone_3       = COALESCE(EXCLUDED.mobile_phone_3, contacts.mobile_phone_3),
      office_phone         = COALESCE(EXCLUDED.office_phone, contacts.office_phone),
      phone_source         = COALESCE(EXCLUDED.phone_source, contacts.phone_source),
      updated_at           = now()
    RETURNING id INTO v_contact_id;

  ELSIF p_remarketing_buyer_id IS NOT NULL THEN
    -- No email, has buyer -> upsert by (name, remarketing_buyer_id)
    INSERT INTO public.contacts
      (first_name, last_name, email, phone, title, linkedin_url,
       is_primary_at_firm, contact_type, remarketing_buyer_id, firm_id, source,
       mobile_phone_1, mobile_phone_2, mobile_phone_3, office_phone, phone_source)
    VALUES
      (p_first_name, p_last_name, NULL,
       NULLIF(TRIM(p_phone), ''),
       NULLIF(TRIM(p_title), ''),
       v_linkedin,
       p_is_primary_at_firm, 'buyer', p_remarketing_buyer_id, p_firm_id, p_source,
       NULLIF(TRIM(p_mobile_phone_1), ''),
       NULLIF(TRIM(p_mobile_phone_2), ''),
       NULLIF(TRIM(p_mobile_phone_3), ''),
       NULLIF(TRIM(p_office_phone), ''),
       NULLIF(TRIM(p_phone_source), ''))
    ON CONFLICT (lower(trim(first_name)), lower(trim(last_name)), remarketing_buyer_id)
      WHERE contact_type = 'buyer' AND email IS NULL
        AND remarketing_buyer_id IS NOT NULL AND archived = false
    DO UPDATE SET
      firm_id            = COALESCE(contacts.firm_id, EXCLUDED.firm_id),
      is_primary_at_firm = contacts.is_primary_at_firm OR EXCLUDED.is_primary_at_firm,
      phone              = COALESCE(EXCLUDED.phone, contacts.phone),
      linkedin_url       = COALESCE(EXCLUDED.linkedin_url, contacts.linkedin_url),
      title              = COALESCE(EXCLUDED.title, contacts.title),
      mobile_phone_1     = COALESCE(EXCLUDED.mobile_phone_1, contacts.mobile_phone_1),
      mobile_phone_2     = COALESCE(EXCLUDED.mobile_phone_2, contacts.mobile_phone_2),
      mobile_phone_3     = COALESCE(EXCLUDED.mobile_phone_3, contacts.mobile_phone_3),
      office_phone       = COALESCE(EXCLUDED.office_phone, contacts.office_phone),
      phone_source       = COALESCE(EXCLUDED.phone_source, contacts.phone_source),
      updated_at         = now()
    RETURNING id INTO v_contact_id;

  ELSE
    -- No email, no buyer -> upsert by name only
    INSERT INTO public.contacts
      (first_name, last_name, email, phone, title, linkedin_url,
       is_primary_at_firm, contact_type, remarketing_buyer_id, firm_id, source,
       mobile_phone_1, mobile_phone_2, mobile_phone_3, office_phone, phone_source)
    VALUES
      (p_first_name, p_last_name, NULL,
       NULLIF(TRIM(p_phone), ''),
       NULLIF(TRIM(p_title), ''),
       v_linkedin,
       p_is_primary_at_firm, 'buyer', NULL, p_firm_id, p_source,
       NULLIF(TRIM(p_mobile_phone_1), ''),
       NULLIF(TRIM(p_mobile_phone_2), ''),
       NULLIF(TRIM(p_mobile_phone_3), ''),
       NULLIF(TRIM(p_office_phone), ''),
       NULLIF(TRIM(p_phone_source), ''))
    ON CONFLICT (lower(trim(first_name)), lower(trim(last_name)))
      WHERE contact_type = 'buyer' AND email IS NULL
        AND remarketing_buyer_id IS NULL AND archived = false
    DO UPDATE SET
      firm_id            = COALESCE(contacts.firm_id, EXCLUDED.firm_id),
      is_primary_at_firm = contacts.is_primary_at_firm OR EXCLUDED.is_primary_at_firm,
      phone              = COALESCE(EXCLUDED.phone, contacts.phone),
      linkedin_url       = COALESCE(EXCLUDED.linkedin_url, contacts.linkedin_url),
      title              = COALESCE(EXCLUDED.title, contacts.title),
      mobile_phone_1     = COALESCE(EXCLUDED.mobile_phone_1, contacts.mobile_phone_1),
      mobile_phone_2     = COALESCE(EXCLUDED.mobile_phone_2, contacts.mobile_phone_2),
      mobile_phone_3     = COALESCE(EXCLUDED.mobile_phone_3, contacts.mobile_phone_3),
      office_phone       = COALESCE(EXCLUDED.office_phone, contacts.office_phone),
      phone_source       = COALESCE(EXCLUDED.phone_source, contacts.phone_source),
      updated_at         = now()
    RETURNING id INTO v_contact_id;
  END IF;

  RETURN v_contact_id;
END;
$$;

-- Re-grant EXECUTE after CREATE OR REPLACE (Postgres preserves existing
-- grants, but re-running belt-and-suspenders guards against environments
-- where the function was dropped and recreated without grants).
GRANT EXECUTE ON FUNCTION public.upsert_buyer_contact(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID, UUID, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated, service_role;

COMMENT ON FUNCTION public.upsert_buyer_contact(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID, UUID, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT
) IS
  'Upserts a buyer-type contact. Resolution order: (1) LinkedIn URL exact '
  'match on live rows, (2) email via idx_contacts_buyer_email_unique, '
  '(3) (name, remarketing_buyer_id) via idx_contacts_buyer_name_rmkt_unique, '
  '(4) name via idx_contacts_buyer_name_only_unique. LinkedIn check runs '
  'first because its unique index is independent of contact_type and email '
  'presence — missing that path caused every Add Contact save to fail with '
  'a generic "Failed to add contact" toast whenever the LinkedIn URL was '
  'already live on any row (enrichment, auto-discovery, etc.).';
