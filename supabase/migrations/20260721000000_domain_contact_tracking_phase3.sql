-- ============================================================================
-- DOMAIN-BASED CONTACT TRACKING — PHASE 3: AUTO-CONTACT DISCOVERY
--
-- When an email arrives at the platform from an unknown address whose domain
-- matches a firm_domain_aliases entry, we auto-create a contact record so
-- future activity links to a real entity and so the firm's touchpoint count
-- reflects the full team rather than just the one person we happened to have
-- pre-loaded. Two call sites:
--
--   1. outlook_unmatched_emails — emails the Outlook sync edge function
--      couldn't match to an existing contact. The existing
--      trg_contacts_rematch_outlook trigger on public.contacts
--      (migration 20260703000001) will automatically promote any unmatched
--      rows whose addresses match the new contact — so all we need to do
--      here is create the contact; the re-match pipeline does the rest.
--
--   2. smartlead_reply_inbox — SmartLead replies from leads we never
--      contacted individually. The inbox table itself has no contact_id
--      column (see 20260318114848), so we just create the contact so the
--      domain-aware unified_contact_timeline picks the reply up on next
--      query via contact_email match.
--
-- Prerequisites:
--   - firm_domain_aliases (20260225000000)
--   - generic_email_domains  (20260225000000)
--   - contacts.email_domain  (20260719000000, Phase 1)
--   - Phase 1 trigger set_contact_email_domain auto-populates the column.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. auto_create_contact_from_email RPC
-- ────────────────────────────────────────────────────────────────────────────
--
-- Returns the UUID of the existing-or-newly-created contact, or NULL when:
--   - the email is malformed
--   - the domain is in generic_email_domains (free/consumer providers)
--   - no firm_domain_aliases entry matches the domain
--
-- Idempotent on the (lower(email)) uniqueness — repeated calls for the same
-- address return the same contact id.
--
-- The p_source argument is stored on contacts.source so downstream UI can
-- distinguish machine-created contacts from manual entries. Callers should
-- pass 'outlook_auto_detected' or 'smartlead_auto_detected'.

CREATE OR REPLACE FUNCTION public.auto_create_contact_from_email(
  p_email TEXT,
  p_source TEXT DEFAULT 'auto_detected'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_domain TEXT;
  v_firm_id UUID;
  v_existing_id UUID;
  v_new_id UUID;
  v_local TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  -- Sanitize & validate
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN NULL;
  END IF;
  v_email := lower(trim(p_email));
  IF position('@' IN v_email) = 0 THEN
    RETURN NULL;
  END IF;

  v_domain := split_part(v_email, '@', 2);
  IF v_domain IS NULL OR v_domain = '' THEN
    RETURN NULL;
  END IF;

  -- Skip generic / free email providers. We never create firm-level
  -- contacts for gmail etc. because the domain doesn't identify a firm.
  IF EXISTS (
    SELECT 1 FROM public.generic_email_domains WHERE domain = v_domain
  ) THEN
    RETURN NULL;
  END IF;

  -- Find the firm this domain belongs to. Primary source of truth is
  -- firm_domain_aliases. Returning NULL here means we don't create orphan
  -- contacts — if the user wants a contact for this domain, an admin must
  -- add the domain alias first.
  SELECT firm_id INTO v_firm_id
  FROM public.firm_domain_aliases
  WHERE domain = v_domain
  LIMIT 1;

  IF v_firm_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- If we already have a contact for this email, return it unchanged.
  -- The contacts table has a unique index on lower(email) (migration
  -- 20260228000000), so this is race-safe under serializable.
  SELECT id INTO v_existing_id
  FROM public.contacts
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- Derive a best-effort first_name from the email local part. We keep
  -- last_name empty because it's the NOT NULL DEFAULT '' convention on
  -- the contacts table and we genuinely don't know it.
  v_local := split_part(v_email, '@', 1);
  IF v_local IS NULL OR v_local = '' THEN
    v_first_name := 'Unknown';
  ELSE
    v_first_name := initcap(split_part(v_local, '.', 1));
    IF v_first_name IS NULL OR v_first_name = '' THEN
      v_first_name := initcap(v_local);
    END IF;
  END IF;
  v_last_name := '';
  IF v_local LIKE '%.%' THEN
    v_last_name := initcap(split_part(v_local, '.', 2));
  END IF;

  -- Insert. The contacts table has a partial unique index on (lower(email))
  -- scoped to WHERE contact_type = 'buyer' AND email IS NOT NULL
  -- AND archived = false (migration 20260228000000). Matching that exact
  -- predicate in ON CONFLICT is fragile, so we use exception handling to
  -- recover from the unique_violation race instead.
  BEGIN
    INSERT INTO public.contacts (
      first_name,
      last_name,
      email,
      firm_id,
      contact_type,
      source
    ) VALUES (
      v_first_name,
      v_last_name,
      v_email,
      v_firm_id,
      'buyer',
      p_source
    )
    RETURNING id INTO v_new_id;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent insert won the race — pick up their row and return it.
    SELECT id INTO v_new_id
    FROM public.contacts
    WHERE lower(email) = v_email
    LIMIT 1;
  END;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.auto_create_contact_from_email(TEXT, TEXT) IS
  'Phase 3 of domain-based contact tracking. Creates a contact for the given email if its domain matches firm_domain_aliases and is not in generic_email_domains. Returns the contact id (new or existing), or NULL if no firm match / generic / malformed.';

GRANT EXECUTE ON FUNCTION public.auto_create_contact_from_email(TEXT, TEXT)
  TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Trigger: auto-create on outlook_unmatched_emails insert
-- ────────────────────────────────────────────────────────────────────────────
--
-- After the Outlook sync queues an unmatched email, iterate participant
-- addresses and try to auto-create a contact for any whose domain matches
-- a firm alias. The existing trg_contacts_rematch_outlook trigger
-- (migration 20260703000001) then promotes this queued row into
-- email_messages for the new contact automatically — so we only need to
-- create the contact here, not to write to email_messages directly.
--
-- Runs AFTER INSERT so NEW.id is populated and the row is visible to the
-- rematch helper when it scans for promotable rows.

CREATE OR REPLACE FUNCTION public.trg_outlook_unmatched_auto_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF NEW.participant_emails IS NULL OR array_length(NEW.participant_emails, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_email IN ARRAY NEW.participant_emails
  LOOP
    -- Silently ignore per-address failures — this is a best-effort
    -- enrichment, not a hard dependency of the email sync pipeline.
    BEGIN
      PERFORM public.auto_create_contact_from_email(v_email, 'outlook_auto_detected');
    EXCEPTION WHEN OTHERS THEN
      -- Log-but-continue pattern. We don't re-raise because Outlook sync
      -- should never fail because an optional auto-create failed.
      RAISE NOTICE 'auto_create_contact_from_email failed for %: %', v_email, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outlook_unmatched_auto_create ON public.outlook_unmatched_emails;

CREATE TRIGGER trg_outlook_unmatched_auto_create
  AFTER INSERT ON public.outlook_unmatched_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_outlook_unmatched_auto_create();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Trigger: auto-create on smartlead_reply_inbox insert
-- ────────────────────────────────────────────────────────────────────────────
--
-- The reply inbox has no contact_id column so we can't link the reply
-- directly. What we CAN do is create the contact so
--   (a) the buyer's ContactsTab surfaces them for enrichment, and
--   (b) the domain-aware unified_contact_timeline picks up the reply via
--       contact_email matching on subsequent queries.

CREATE OR REPLACE FUNCTION public.trg_smartlead_reply_auto_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.from_email IS NULL OR NEW.from_email = '' THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM public.auto_create_contact_from_email(NEW.from_email, 'smartlead_auto_detected');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'auto_create_contact_from_email failed for smartlead reply %: %',
      NEW.from_email, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_smartlead_reply_auto_create ON public.smartlead_reply_inbox;

CREATE TRIGGER trg_smartlead_reply_auto_create
  AFTER INSERT ON public.smartlead_reply_inbox
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_smartlead_reply_auto_create();
