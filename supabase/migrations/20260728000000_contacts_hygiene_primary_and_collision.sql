-- ============================================================================
-- MIGRATION: contacts hygiene — is_primary_at_firm uniqueness,
--            archived/deleted_at reconciliation, and email-collision
--            guard in upsert_buyer_contact
-- ============================================================================
-- Three loose ends from the CTO-level audit of the "Failed to add contact"
-- and teaser-generation rollout. All three bit in production or could
-- quietly corrupt the contact graph, so they're landed here as a single
-- transactional migration.
--
-- ─── 1. is_primary_at_firm must be unique per (firm_id, contact_type) ───
-- Seller contacts already have an equivalent invariant enforced by the
-- sync_primary_seller_contact trigger (20260222031933): when a row is
-- flipped to is_primary_seller_contact=true, every other seller row on
-- the same listing is flipped back to false. Buyer/advisor/portal_user
-- rows had no such guard. Result: multiple "primary at firm" rows can
-- accumulate, the contact-picker dropdowns show two primaries at the
-- same firm, and outreach flows that `.order('is_primary_at_firm',
-- {ascending:false}).limit(1)` return a different row each time the
-- query plan changes.
--
-- We enforce the invariant with a trigger rather than a partial unique
-- index because is_primary_at_firm DEFAULT false means many rows share
-- the value and you can't build a partial unique index that forbids
-- "two trues" in a firm without also forbidding "two falses" — which is
-- the common case. The trigger flips any existing primary at the same
-- firm back to false before the write commits, mirroring the seller
-- pattern exactly.
--
-- ─── 2. Archived rows without deleted_at ───
-- 20260625000004 introduced deleted_at as the canonical soft-delete
-- marker ("replaces archived semantically") but never backfilled it
-- from the archived column. That left rows where archived=true AND
-- deleted_at IS NULL. The new LinkedIn / email / phone partial unique
-- indexes use the deleted_at predicate rather than archived, so an
-- "archived" contact still occupies its slot in the LinkedIn uniqueness
-- namespace. Re-adding the same person via the buyer form then hits a
-- duplicate-key error even though the buyer detail page no longer shows
-- the ghost row.
--
-- Backfill deleted_at = now() for every row where archived=true AND
-- deleted_at IS NULL so the two soft-delete conventions match. Keep
-- archived in place as a read-compat column — nothing depends on
-- clearing it.
--
-- ─── 3. upsert_buyer_contact raises on cross-buyer email collision ───
-- Today if the admin adds carson@example.com under Buyer B but an
-- existing buyer contact with that email already lives on Buyer A, the
-- ON CONFLICT branch's COALESCE keeps Buyer A's id and RETURNING gives
-- the caller the existing row. The client's toast says "Contact added"
-- while the page listing (filtered by the current buyer id) stays empty
-- — a silent misdirection flagged as HIGH in the audit.
--
-- Raise a categorised exception instead so the UI can surface
-- "Contact with this email already belongs to another buyer" and the
-- admin can choose to edit on the other buyer's page.
-- ============================================================================


-- ─── Part 1: is_primary_at_firm uniqueness (buyer / advisor / portal) ─────

CREATE OR REPLACE FUNCTION public.sync_primary_at_firm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when the row was just flipped to primary AND has a firm scope
  -- to be primary at. "Firm scope" is either marketplace firm_id (for
  -- federated rows) or remarketing_buyer_id (buyer-scoped rows that haven't
  -- been attached to a firm_agreement yet).
  IF NEW.is_primary_at_firm = true
     AND (NEW.firm_id IS NOT NULL OR NEW.remarketing_buyer_id IS NOT NULL)
     AND NEW.contact_type IN ('buyer', 'advisor', 'portal_user')
  THEN
    UPDATE public.contacts
    SET is_primary_at_firm = false,
        updated_at = now()
    WHERE id <> NEW.id
      AND contact_type = NEW.contact_type
      AND is_primary_at_firm = true
      AND deleted_at IS NULL
      AND merged_into_id IS NULL
      AND (
        -- Same firm (federated) OR same buyer org (unfederated)
        (NEW.firm_id IS NOT NULL AND firm_id = NEW.firm_id)
        OR (NEW.firm_id IS NULL
            AND NEW.remarketing_buyer_id IS NOT NULL
            AND remarketing_buyer_id = NEW.remarketing_buyer_id)
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_primary_at_firm ON public.contacts;
CREATE TRIGGER trg_sync_primary_at_firm
  AFTER INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  WHEN (NEW.is_primary_at_firm = true)
  EXECUTE FUNCTION public.sync_primary_at_firm();

COMMENT ON FUNCTION public.sync_primary_at_firm() IS
  'Enforces at most one is_primary_at_firm=true per (firm_id, contact_type) '
  'for buyer/advisor/portal_user rows. Mirrors sync_primary_seller_contact '
  'which does the same thing for contact_type=''seller''. Fires AFTER the '
  'write and flips other live primaries to false.';


-- ─── Part 2: archived → deleted_at reconciliation backfill ────────────────

UPDATE public.contacts
SET deleted_at = now()
WHERE archived = true
  AND deleted_at IS NULL;


-- ─── Part 3: upsert_buyer_contact — cross-buyer email collision ───────────

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
  v_existing_buyer UUID;
BEGIN
  -- 0a. Cross-buyer email collision guard. If this email already lives on
  -- a LIVE buyer-type contact tied to a DIFFERENT remarketing_buyer_id,
  -- the caller is about to silently lose their intent (the contact ends
  -- up on the other buyer). Raise with a categorised SQLSTATE so the UI
  -- can render a human-actionable message instead of a silent "added".
  IF v_email IS NOT NULL AND p_remarketing_buyer_id IS NOT NULL THEN
    SELECT remarketing_buyer_id
      INTO v_existing_buyer
    FROM public.contacts
    WHERE lower(email) = v_email
      AND contact_type = 'buyer'
      AND deleted_at IS NULL
      AND merged_into_id IS NULL
      AND archived = false
      AND remarketing_buyer_id IS NOT NULL
      AND remarketing_buyer_id <> p_remarketing_buyer_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_existing_buyer IS NOT NULL THEN
      RAISE EXCEPTION 'Contact with email % is already attached to buyer %',
        v_email, v_existing_buyer
        USING ERRCODE = 'P0001',
              HINT = 'Open that buyer and edit the contact there, '
                     'or merge the two buyer orgs first.';
    END IF;
  END IF;

  -- 0b. LinkedIn resolution — unchanged from 20260727000000.
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
        remarketing_buyer_id = COALESCE(remarketing_buyer_id, p_remarketing_buyer_id),
        firm_id              = COALESCE(firm_id, p_firm_id),
        is_primary_at_firm   = is_primary_at_firm OR p_is_primary_at_firm,
        mobile_phone_1       = COALESCE(mobile_phone_1, NULLIF(TRIM(p_mobile_phone_1), '')),
        mobile_phone_2       = COALESCE(mobile_phone_2, NULLIF(TRIM(p_mobile_phone_2), '')),
        mobile_phone_3       = COALESCE(mobile_phone_3, NULLIF(TRIM(p_mobile_phone_3), '')),
        office_phone         = COALESCE(office_phone, NULLIF(TRIM(p_office_phone), '')),
        phone_source         = COALESCE(phone_source, NULLIF(TRIM(p_phone_source), '')),
        archived             = false,
        updated_at           = now()
      WHERE id = v_contact_id;

      RETURN v_contact_id;
    END IF;
  END IF;

  IF v_email IS NOT NULL THEN
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

GRANT EXECUTE ON FUNCTION public.upsert_buyer_contact(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID, UUID, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated, service_role;
