-- =============================================================================
-- Outreach Unmatched Queue — Auto-Promotion
-- =============================================================================
-- When a new contact is inserted (or an existing contact gets its email /
-- linkedin_url / remarketing_buyer_id / listing_id updated), scan the
-- unmatched queues for any records that now match and promote them into the
-- main smartlead_messages / heyreach_messages tables.
--
-- Without this, unmatched records stay in their retry queues forever unless
-- the sync worker re-processes the source lead and happens to bring the
-- event back through. The promotion function + trigger closes that loop.
--
-- Design:
--   - Idempotent: promotion uses ON CONFLICT DO NOTHING, so double-firing is safe
--   - Respects buyer/seller XOR: only promotes when the contact has the required
--     anchor (remarketing_buyer_id for buyers, listing_id for sellers)
--   - Marks unmatched rows as matched via `matched_at = now()` when promoted,
--     so they don't get re-scanned on every future update
--   - Trigger runs AFTER INSERT / UPDATE OF email, linkedin_url, contact_type,
--     remarketing_buyer_id, listing_id on contacts — narrow WHEN clause so
--     random contact updates (e.g. title changes) don't trigger scans
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Core promotion function — scans both queues and resolves matching records
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_unmatched_outreach_for_contact(p_contact_id UUID)
RETURNS TABLE (
  channel TEXT,
  promoted_count INTEGER,
  skipped_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact RECORD;
  v_email TEXT;
  v_linkedin TEXT;
  v_linkedin_stem TEXT;
  v_smartlead_promoted INTEGER := 0;
  v_smartlead_skipped INTEGER := 0;
  v_heyreach_promoted INTEGER := 0;
  v_heyreach_skipped INTEGER := 0;
BEGIN
  -- Load the contact. If it doesn't exist or is archived, bail.
  SELECT id, email, linkedin_url, contact_type, remarketing_buyer_id, listing_id, archived
    INTO v_contact
    FROM contacts
    WHERE id = p_contact_id;

  IF NOT FOUND OR v_contact.archived = true THEN
    RETURN;
  END IF;

  -- Only buyers and sellers can anchor outreach rows
  IF v_contact.contact_type NOT IN ('buyer', 'seller') THEN
    RETURN;
  END IF;

  -- Enforce anchor requirement up-front — if the contact doesn't have the
  -- required anchor, nothing can be promoted. (Scenario: advisor → buyer
  -- re-classification but firm not yet set.)
  IF v_contact.contact_type = 'buyer' AND v_contact.remarketing_buyer_id IS NULL THEN
    RETURN;
  END IF;
  IF v_contact.contact_type = 'seller' AND v_contact.listing_id IS NULL THEN
    RETURN;
  END IF;

  v_email := lower(trim(v_contact.email));
  v_linkedin := v_contact.linkedin_url;

  -- Normalized LinkedIn "stem" (strip protocol, www, trailing slash, params)
  -- Mirrors normalizeLinkedInUrl() in outreach-match.ts — must stay in sync.
  IF v_linkedin IS NOT NULL AND length(trim(v_linkedin)) > 0 THEN
    v_linkedin_stem := lower(trim(v_linkedin));
    v_linkedin_stem := regexp_replace(v_linkedin_stem, '^https?://', '');
    v_linkedin_stem := regexp_replace(v_linkedin_stem, '^www\.', '');
    v_linkedin_stem := regexp_replace(v_linkedin_stem, '[\?#].*$', '');
    v_linkedin_stem := regexp_replace(v_linkedin_stem, '/+$', '');
    v_linkedin_stem := regexp_replace(v_linkedin_stem, '^linkedin\.com/', '');
  END IF;


  -- ── SmartLead promotion ──────────────────────────────────────────────────
  IF v_email IS NOT NULL AND length(v_email) > 0 THEN
    WITH candidates AS (
      SELECT *
      FROM smartlead_unmatched_messages
      WHERE matched_at IS NULL
        AND smartlead_message_id IS NOT NULL
        AND lower(lead_email) = v_email
      FOR UPDATE
    ),
    inserted AS (
      INSERT INTO smartlead_messages (
        smartlead_message_id, smartlead_lead_id, smartlead_campaign_id,
        contact_id, contact_type,
        remarketing_buyer_id, listing_id,
        direction, from_address, to_addresses, cc_addresses,
        subject, body_html, body_text,
        sent_at, event_type, sequence_number, raw_payload
      )
      SELECT
        c.smartlead_message_id,
        c.smartlead_lead_id,
        c.smartlead_campaign_id,
        v_contact.id,
        v_contact.contact_type,
        CASE WHEN v_contact.contact_type = 'buyer'  THEN v_contact.remarketing_buyer_id ELSE NULL END,
        CASE WHEN v_contact.contact_type = 'seller' THEN v_contact.listing_id          ELSE NULL END,
        COALESCE(c.direction, 'outbound'::public.email_direction),
        COALESCE(c.from_address, 'unknown@unknown'),
        COALESCE(c.to_addresses, '{}'::TEXT[]),
        '{}'::TEXT[],
        c.subject, c.body_html, c.body_text,
        COALESCE(c.sent_at, now()),
        COALESCE(c.event_type, 'sent'),
        c.sequence_number,
        c.raw_payload
      FROM candidates c
      -- Only promote rows whose sent_at is non-null (sent_at is NOT NULL in
      -- smartlead_messages). If sent_at is null in the queue, we fall back to now().
      ON CONFLICT (smartlead_message_id, contact_id) DO NOTHING
      RETURNING smartlead_message_id
    )
    UPDATE smartlead_unmatched_messages su
      SET matched_at = now()
      WHERE su.smartlead_message_id IN (SELECT smartlead_message_id FROM inserted)
        AND lower(su.lead_email) = v_email;

    GET DIAGNOSTICS v_smartlead_promoted = ROW_COUNT;

    -- Count candidates we scanned but couldn't promote (e.g. conflict skip)
    SELECT COUNT(*) INTO v_smartlead_skipped
      FROM smartlead_unmatched_messages
      WHERE matched_at IS NULL
        AND lower(lead_email) = v_email
        AND smartlead_message_id IS NOT NULL;
  END IF;


  -- ── HeyReach promotion ───────────────────────────────────────────────────
  -- HeyReach matches primarily by LinkedIn URL, fallback to email
  IF v_linkedin_stem IS NOT NULL AND length(v_linkedin_stem) > 0 THEN
    WITH candidates AS (
      SELECT *
      FROM heyreach_unmatched_messages
      WHERE matched_at IS NULL
        AND heyreach_message_id IS NOT NULL
        AND (
          -- Normalize stored URL and compare
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(lower(trim(lead_linkedin_url)), '^https?://', ''),
                  '^www\.', ''
                ),
                '[\?#].*$', ''
              ),
              '/+$', ''
            ),
            '^linkedin\.com/', ''
          ) = v_linkedin_stem
        )
      FOR UPDATE
    ),
    inserted AS (
      INSERT INTO heyreach_messages (
        heyreach_message_id, heyreach_lead_id, heyreach_campaign_id,
        contact_id, contact_type,
        remarketing_buyer_id, listing_id,
        direction,
        from_linkedin_url, to_linkedin_url,
        message_type, subject, body_text,
        sent_at, event_type, raw_payload
      )
      SELECT
        c.heyreach_message_id,
        c.heyreach_lead_id,
        c.heyreach_campaign_id,
        v_contact.id,
        v_contact.contact_type,
        CASE WHEN v_contact.contact_type = 'buyer'  THEN v_contact.remarketing_buyer_id ELSE NULL END,
        CASE WHEN v_contact.contact_type = 'seller' THEN v_contact.listing_id          ELSE NULL END,
        COALESCE(c.direction, 'outbound'::public.email_direction),
        c.from_linkedin_url,
        c.to_linkedin_url,
        COALESCE(c.message_type, 'message'),
        c.subject,
        c.body_text,
        COALESCE(c.sent_at, now()),
        COALESCE(c.event_type, 'message_sent'),
        c.raw_payload
      FROM candidates c
      ON CONFLICT (heyreach_message_id, contact_id) DO NOTHING
      RETURNING heyreach_message_id
    )
    UPDATE heyreach_unmatched_messages hu
      SET matched_at = now()
      WHERE hu.heyreach_message_id IN (SELECT heyreach_message_id FROM inserted);

    GET DIAGNOSTICS v_heyreach_promoted = ROW_COUNT;
  END IF;

  -- Also try email-based HeyReach match as fallback
  IF v_email IS NOT NULL AND length(v_email) > 0 THEN
    WITH candidates AS (
      SELECT *
      FROM heyreach_unmatched_messages
      WHERE matched_at IS NULL
        AND heyreach_message_id IS NOT NULL
        AND lower(lead_email) = v_email
      FOR UPDATE
    ),
    inserted AS (
      INSERT INTO heyreach_messages (
        heyreach_message_id, heyreach_lead_id, heyreach_campaign_id,
        contact_id, contact_type,
        remarketing_buyer_id, listing_id,
        direction, from_linkedin_url, to_linkedin_url,
        message_type, subject, body_text,
        sent_at, event_type, raw_payload
      )
      SELECT
        c.heyreach_message_id,
        c.heyreach_lead_id,
        c.heyreach_campaign_id,
        v_contact.id,
        v_contact.contact_type,
        CASE WHEN v_contact.contact_type = 'buyer'  THEN v_contact.remarketing_buyer_id ELSE NULL END,
        CASE WHEN v_contact.contact_type = 'seller' THEN v_contact.listing_id          ELSE NULL END,
        COALESCE(c.direction, 'outbound'::public.email_direction),
        c.from_linkedin_url,
        c.to_linkedin_url,
        COALESCE(c.message_type, 'message'),
        c.subject,
        c.body_text,
        COALESCE(c.sent_at, now()),
        COALESCE(c.event_type, 'message_sent'),
        c.raw_payload
      FROM candidates c
      ON CONFLICT (heyreach_message_id, contact_id) DO NOTHING
      RETURNING heyreach_message_id
    )
    UPDATE heyreach_unmatched_messages hu
      SET matched_at = now()
      WHERE hu.heyreach_message_id IN (SELECT heyreach_message_id FROM inserted)
        AND lower(hu.lead_email) = v_email;
  END IF;


  -- Return results
  RETURN QUERY SELECT 'smartlead'::TEXT, v_smartlead_promoted, v_smartlead_skipped;
  RETURN QUERY SELECT 'heyreach'::TEXT, v_heyreach_promoted, 0;
END;
$$;

COMMENT ON FUNCTION public.promote_unmatched_outreach_for_contact(UUID) IS
  'Scans smartlead_unmatched_messages and heyreach_unmatched_messages for rows '
  'matching the given contact (by email and normalized LinkedIn URL) and '
  'promotes them into the main message tables. Called by a trigger on '
  'contacts INSERT/UPDATE of identifier columns.';


-- -----------------------------------------------------------------------------
-- Trigger — fire on contact changes that affect matchability
-- -----------------------------------------------------------------------------
-- Narrowed WHEN clause so routine updates (title changes, notes) don't trigger
-- a scan. Only fires when email, linkedin_url, contact_type, or one of the
-- anchor columns (remarketing_buyer_id, listing_id) changes.
CREATE OR REPLACE FUNCTION public.trg_promote_unmatched_outreach()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Fire-and-forget. Don't care about the return value — the function logs
  -- its own diagnostics. Any exception here must NOT break the contact write,
  -- so wrap in an exception handler.
  BEGIN
    PERFORM public.promote_unmatched_outreach_for_contact(NEW.id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'promote_unmatched_outreach_for_contact failed for contact % — %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_promote_unmatched_outreach ON public.contacts;
CREATE TRIGGER contacts_promote_unmatched_outreach
  AFTER INSERT OR UPDATE OF email, linkedin_url, contact_type, remarketing_buyer_id, listing_id
  ON public.contacts
  FOR EACH ROW
  WHEN (NEW.archived = false)
  EXECUTE FUNCTION public.trg_promote_unmatched_outreach();

COMMENT ON TRIGGER contacts_promote_unmatched_outreach ON public.contacts IS
  'Scans unmatched outreach queues and promotes resolvable records whenever a '
  'contact is created or its identifiers/anchors change.';


-- -----------------------------------------------------------------------------
-- Grants (function is SECURITY DEFINER so explicit execute grants are not
-- strictly necessary, but make intent clear)
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.promote_unmatched_outreach_for_contact(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_unmatched_outreach_for_contact(UUID) TO service_role;
