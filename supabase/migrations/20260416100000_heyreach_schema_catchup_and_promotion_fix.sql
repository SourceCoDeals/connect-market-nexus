-- =============================================================================
-- HeyReach schema catch-up + promotion function rewrite
-- =============================================================================
-- Discovered via CONTACT_ACTIVITY_DEEP_DIVE_AUDIT_2026-04-16: production
-- `heyreach_messages` and `heyreach_unmatched_messages` drifted from their
-- original migration (20260414000000_outreach_messages.sql). The intent was
-- to align them with the smartlead_messages shape (email-style columns) so
-- the unified_contact_timeline view could treat both channels uniformly.
--
-- Changes shipped to prod by that drift:
--   - from_linkedin_url / to_linkedin_url  →  from_address / to_addresses
--   - added linkedin_url (lead's profile URL), sequence_number, body_html
--   - dropped message_type (classification now lives in event_type + raw_payload)
--
-- This migration brings any dev environment that followed the literal migration
-- file up to match prod. It is idempotent against prod (every change is IF
-- EXISTS / IF NOT EXISTS) so reapplying is a no-op.
--
-- We also replace the deployed `promote_unmatched_outreach_for_contact`
-- function — its HeyReach INSERT referenced from_linkedin_url / to_linkedin_url
-- / message_type, so any HeyReach promotion would have failed with "column
-- does not exist". The function has been silent so far only because
-- heyreach_unmatched_messages has zero rows in prod — but any future HeyReach
-- activity would have tripped this immediately.
-- =============================================================================


-- ── heyreach_messages: align columns with prod shape ─────────────────────────
ALTER TABLE public.heyreach_messages
  ADD COLUMN IF NOT EXISTS from_address    TEXT,
  ADD COLUMN IF NOT EXISTS to_addresses    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS body_html       TEXT,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
  ADD COLUMN IF NOT EXISTS linkedin_url    TEXT;

-- Migrate any data that existed under the old column names before dropping.
-- Safe because IF EXISTS handles the case where the old columns are already gone.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='heyreach_messages'
      AND column_name='from_linkedin_url'
  ) THEN
    UPDATE public.heyreach_messages
      SET from_address = COALESCE(from_address, from_linkedin_url)
      WHERE from_linkedin_url IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='heyreach_messages'
      AND column_name='to_linkedin_url'
  ) THEN
    UPDATE public.heyreach_messages
      SET to_addresses = COALESCE(to_addresses, ARRAY[to_linkedin_url]::TEXT[])
      WHERE to_linkedin_url IS NOT NULL
        AND (to_addresses IS NULL OR array_length(to_addresses, 1) IS NULL);
  END IF;
END $$;

ALTER TABLE public.heyreach_messages
  DROP COLUMN IF EXISTS from_linkedin_url,
  DROP COLUMN IF EXISTS to_linkedin_url,
  DROP COLUMN IF EXISTS message_type;


-- ── heyreach_unmatched_messages: same alignment ──────────────────────────────
ALTER TABLE public.heyreach_unmatched_messages
  ADD COLUMN IF NOT EXISTS from_address    TEXT,
  ADD COLUMN IF NOT EXISTS to_addresses    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS body_html       TEXT,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='heyreach_unmatched_messages'
      AND column_name='from_linkedin_url'
  ) THEN
    UPDATE public.heyreach_unmatched_messages
      SET from_address = COALESCE(from_address, from_linkedin_url)
      WHERE from_linkedin_url IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='heyreach_unmatched_messages'
      AND column_name='to_linkedin_url'
  ) THEN
    UPDATE public.heyreach_unmatched_messages
      SET to_addresses = COALESCE(to_addresses, ARRAY[to_linkedin_url]::TEXT[])
      WHERE to_linkedin_url IS NOT NULL
        AND (to_addresses IS NULL OR array_length(to_addresses, 1) IS NULL);
  END IF;
END $$;

ALTER TABLE public.heyreach_unmatched_messages
  DROP COLUMN IF EXISTS from_linkedin_url,
  DROP COLUMN IF EXISTS to_linkedin_url,
  DROP COLUMN IF EXISTS message_type;


-- ── Replace promotion function — correct column refs for prod schema ────────
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
BEGIN
  SELECT id, email, linkedin_url, contact_type, remarketing_buyer_id, listing_id, archived
    INTO v_contact
    FROM contacts
    WHERE id = p_contact_id;

  IF NOT FOUND OR v_contact.archived = true THEN
    RETURN;
  END IF;

  IF v_contact.contact_type NOT IN ('buyer', 'seller') THEN
    RETURN;
  END IF;

  IF v_contact.contact_type = 'buyer'  AND v_contact.remarketing_buyer_id IS NULL THEN RETURN; END IF;
  IF v_contact.contact_type = 'seller' AND v_contact.listing_id          IS NULL THEN RETURN; END IF;

  v_email := lower(trim(v_contact.email));
  v_linkedin := v_contact.linkedin_url;

  IF v_linkedin IS NOT NULL AND length(trim(v_linkedin)) > 0 THEN
    v_linkedin_stem := lower(trim(v_linkedin));
    v_linkedin_stem := regexp_replace(v_linkedin_stem, '^https?://', '');
    v_linkedin_stem := regexp_replace(v_linkedin_stem, '^www\.', '');
    v_linkedin_stem := regexp_replace(v_linkedin_stem, '[\?#].*$', '');
    v_linkedin_stem := regexp_replace(v_linkedin_stem, '/+$', '');
    v_linkedin_stem := regexp_replace(v_linkedin_stem, '^linkedin\.com/', '');
  END IF;


  -- ── SmartLead promotion (unchanged — schema is stable) ─────────────────
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
        COALESCE(c.direction, 'outbound'),
        COALESCE(c.from_address, 'unknown@unknown'),
        COALESCE(c.to_addresses, '{}'::TEXT[]),
        '{}'::TEXT[],
        c.subject, c.body_html, c.body_text,
        COALESCE(c.sent_at, now()),
        COALESCE(c.event_type, 'sent'),
        c.sequence_number,
        c.raw_payload
      FROM candidates c
      ON CONFLICT (smartlead_message_id, contact_id) DO NOTHING
      RETURNING smartlead_message_id
    )
    UPDATE smartlead_unmatched_messages su
      SET matched_at = now()
      WHERE su.smartlead_message_id IN (SELECT smartlead_message_id FROM inserted)
        AND lower(su.lead_email) = v_email;

    GET DIAGNOSTICS v_smartlead_promoted = ROW_COUNT;

    SELECT COUNT(*) INTO v_smartlead_skipped
      FROM smartlead_unmatched_messages
      WHERE matched_at IS NULL
        AND lower(lead_email) = v_email
        AND smartlead_message_id IS NOT NULL;
  END IF;


  -- ── HeyReach promotion — uses prod schema (from_address / to_addresses / no message_type) ──
  IF v_linkedin_stem IS NOT NULL AND length(v_linkedin_stem) > 0 THEN
    WITH candidates AS (
      SELECT *
      FROM heyreach_unmatched_messages
      WHERE matched_at IS NULL
        AND heyreach_message_id IS NOT NULL
        AND (
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
        from_address, to_addresses, linkedin_url,
        subject, body_text,
        sent_at, event_type, sequence_number, raw_payload
      )
      SELECT
        c.heyreach_message_id,
        c.heyreach_lead_id,
        c.heyreach_campaign_id,
        v_contact.id,
        v_contact.contact_type,
        CASE WHEN v_contact.contact_type = 'buyer'  THEN v_contact.remarketing_buyer_id ELSE NULL END,
        CASE WHEN v_contact.contact_type = 'seller' THEN v_contact.listing_id          ELSE NULL END,
        COALESCE(c.direction, 'outbound'),
        c.from_address,
        COALESCE(c.to_addresses, '{}'::TEXT[]),
        c.lead_linkedin_url,
        c.subject,
        c.body_text,
        COALESCE(c.sent_at, now()),
        COALESCE(c.event_type, 'message_sent'),
        c.sequence_number,
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

  -- Email fallback for HeyReach
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
        direction,
        from_address, to_addresses, linkedin_url,
        subject, body_text,
        sent_at, event_type, sequence_number, raw_payload
      )
      SELECT
        c.heyreach_message_id,
        c.heyreach_lead_id,
        c.heyreach_campaign_id,
        v_contact.id,
        v_contact.contact_type,
        CASE WHEN v_contact.contact_type = 'buyer'  THEN v_contact.remarketing_buyer_id ELSE NULL END,
        CASE WHEN v_contact.contact_type = 'seller' THEN v_contact.listing_id          ELSE NULL END,
        COALESCE(c.direction, 'outbound'),
        c.from_address,
        COALESCE(c.to_addresses, '{}'::TEXT[]),
        c.lead_linkedin_url,
        c.subject,
        c.body_text,
        COALESCE(c.sent_at, now()),
        COALESCE(c.event_type, 'message_sent'),
        c.sequence_number,
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


  RETURN QUERY SELECT 'smartlead'::TEXT, v_smartlead_promoted, v_smartlead_skipped;
  RETURN QUERY SELECT 'heyreach'::TEXT,  v_heyreach_promoted,  0;
END;
$$;

COMMENT ON FUNCTION public.promote_unmatched_outreach_for_contact(UUID) IS
  'Scans smartlead_unmatched_messages and heyreach_unmatched_messages for rows '
  'matching the given contact and promotes them into the main message tables. '
  'Fixed 2026-04-16 to use the prod heyreach schema (from_address/to_addresses/'
  'linkedin_url) — previous version referenced non-existent columns.';
