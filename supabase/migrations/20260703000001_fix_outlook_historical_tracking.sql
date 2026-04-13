-- ============================================================================
-- OUTLOOK EMAIL INTEGRATION — HISTORICAL TRACKING AUDIT FIXES
-- ============================================================================
--
-- Context
-- -------
-- An earlier audit (migration 20260629000000_outlook_audit_phase2.sql) added
-- a trigger + backfill intended to keep `email_messages.deal_id` in sync
-- whenever a deal's buyer/seller contact changed. That migration was authored
-- AFTER `public.deals` had already been renamed to `public.deal_pipeline`
-- (migration 20260506000000), but still referenced `public.deals` — meaning
-- the trigger and the backfill UPDATE silently target a non-existent table.
-- On databases where that migration ran successfully, the trigger is bound
-- to a table that no longer receives writes (or errored and was skipped).
-- Either way, the net effect is that `email_messages.deal_id` has NOT been
-- kept in sync with deal-contact assignments, and historical Outlook emails
-- are NOT reliably tracked against the deals they belong to.
--
-- Additionally, the `outlook-sync-emails` edge function silently drops any
-- email whose sender/recipient isn't an already-known contact. Because the
-- Outlook Graph API only supports a bounded lookback window, those dropped
-- emails are lost forever — even if a matching contact is created later.
--
-- This migration
-- --------------
-- 1. Drops the broken trigger + backfill that referenced `public.deals`.
-- 2. Creates a corrected trigger bound to `public.deal_pipeline` that
--    re-links `email_messages.deal_id` when `buyer_contact_id` or
--    `seller_contact_id` changes on a deal.
-- 3. Runs the missed backfill against `deal_pipeline`, linking
--    `email_messages.deal_id` wherever a contact is attached to an
--    active deal.
-- 4. Adds an `outlook_unmatched_emails` queue that persists emails which
--    didn't match any known contact at sync time, so they can be
--    retro-linked to contacts/deals added later.
-- 5. Adds a lazy re-matching trigger on `public.contacts` that promotes
--    queued unmatched emails into `email_messages` (and links them to the
--    appropriate deal) when a new contact is created or when an existing
--    contact gets an email address assigned.
-- 6. Provides `public.rematch_unmatched_outlook_emails()` — a helper that
--    can be called from edge functions / scheduled jobs to retry matching
--    without requiring a contact-level change.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Drop the broken artifacts from migration 20260629000000
-- ---------------------------------------------------------------------------
-- Note: `DROP TRIGGER ... IF EXISTS` requires the underlying table to exist,
-- so we guard the legacy `public.deals` drop in a DO block. We also drop the
-- NEW trigger name (`trg_deal_pipeline_update_email_deal_id`) here so a
-- re-run of this migration doesn't leave a dangling dependency on
-- `public.update_email_messages_deal_id()`, which we're about to replace.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_class
     WHERE relname = 'deals'
       AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_deals_update_email_deal_id ON public.deals';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_deals_update_email_deal_id ON public.deal_pipeline;
DROP TRIGGER IF EXISTS trg_deal_pipeline_update_email_deal_id ON public.deal_pipeline;
DROP FUNCTION IF EXISTS public.update_email_messages_deal_id();

-- ---------------------------------------------------------------------------
-- 1b. Repoint `email_messages.deal_id` FK at `deal_pipeline`
-- ---------------------------------------------------------------------------
--    The original `email_messages` table (20260617000000) declared
--    `deal_id UUID REFERENCES public.deals(id)`. When `deals` was renamed
--    to `deal_pipeline`, Postgres auto-follows the FK reference — but the
--    auto-follow only holds if the FK was created BEFORE the rename.
--    Because `email_messages` was created *after* the rename in at least
--    some environments, the constraint may already point at the right
--    table or may be in an inconsistent state. Re-creating the FK
--    explicitly eliminates both ambiguity and any risk of INSERTs failing
--    against a dangling reference.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Drop any existing FK on email_messages.deal_id regardless of its name.
  FOR v_constraint_name IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'email_messages'
       AND att.attname = 'deal_id'
       AND con.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.email_messages DROP CONSTRAINT %I', v_constraint_name);
  END LOOP;

  -- Recreate the FK pointing at deal_pipeline with ON DELETE SET NULL so
  -- that deleting a deal preserves the email history against its contacts.
  ALTER TABLE public.email_messages
    ADD CONSTRAINT email_messages_deal_id_fkey
    FOREIGN KEY (deal_id)
    REFERENCES public.deal_pipeline(id)
    ON DELETE SET NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Re-create the trigger against the correct table (`deal_pipeline`)
-- ---------------------------------------------------------------------------
--    When a deal's buyer/seller contact changes we:
--      - Clear the `deal_id` on emails that were linked to the OLD contact
--        under this deal (so they don't point at a stale relationship).
--      - Set `deal_id` on emails for the NEW contact that currently have
--        no deal attached.
--
--    We intentionally only touch rows with NULL `deal_id` when setting the
--    new value — emails that were explicitly assigned to a different deal
--    by a user should not be overwritten.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_email_messages_deal_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.buyer_contact_id IS DISTINCT FROM OLD.buyer_contact_id THEN
    IF OLD.buyer_contact_id IS NOT NULL THEN
      UPDATE public.email_messages
         SET deal_id = NULL
       WHERE contact_id = OLD.buyer_contact_id
         AND deal_id = OLD.id;
    END IF;

    IF NEW.buyer_contact_id IS NOT NULL THEN
      UPDATE public.email_messages
         SET deal_id = NEW.id
       WHERE contact_id = NEW.buyer_contact_id
         AND deal_id IS NULL;
    END IF;
  END IF;

  IF NEW.seller_contact_id IS DISTINCT FROM OLD.seller_contact_id THEN
    IF OLD.seller_contact_id IS NOT NULL THEN
      UPDATE public.email_messages
         SET deal_id = NULL
       WHERE contact_id = OLD.seller_contact_id
         AND deal_id = OLD.id;
    END IF;

    IF NEW.seller_contact_id IS NOT NULL THEN
      UPDATE public.email_messages
         SET deal_id = NEW.id
       WHERE contact_id = NEW.seller_contact_id
         AND deal_id IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_pipeline_update_email_deal_id ON public.deal_pipeline;
CREATE TRIGGER trg_deal_pipeline_update_email_deal_id
  AFTER UPDATE OF buyer_contact_id, seller_contact_id
  ON public.deal_pipeline
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_messages_deal_id();

-- ---------------------------------------------------------------------------
-- 3. Backfill `email_messages.deal_id` against `deal_pipeline`
-- ---------------------------------------------------------------------------
--    Links every NULL-deal email to the non-deleted deal whose
--    buyer_contact_id or seller_contact_id matches the email's contact.
-- ---------------------------------------------------------------------------

UPDATE public.email_messages em
   SET deal_id = dp.id
  FROM public.deal_pipeline dp
 WHERE em.deal_id IS NULL
   AND dp.deleted_at IS NULL
   AND (
     dp.buyer_contact_id  = em.contact_id
     OR dp.seller_contact_id = em.contact_id
   );

-- ---------------------------------------------------------------------------
-- 4. Queue of unmatched Outlook emails
-- ---------------------------------------------------------------------------
--    The sync engine currently discards any email whose participants don't
--    resolve to a known contact. That means if we later add a contact who
--    was on an older thread, we permanently lose that history. This table
--    retains the raw data (plus all participant addresses) so we can
--    retroactively create `email_messages` rows when a matching contact
--    shows up.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.outlook_unmatched_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  microsoft_message_id TEXT NOT NULL,
  microsoft_conversation_id TEXT,

  -- Owning mailbox (team member whose Outlook was synced)
  sourceco_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mailbox_address TEXT NOT NULL,

  direction public.email_direction NOT NULL,
  from_address TEXT NOT NULL,
  to_addresses TEXT[] NOT NULL DEFAULT '{}',
  cc_addresses TEXT[] NOT NULL DEFAULT '{}',

  -- Flat, lower-cased list of every non-mailbox participant, for cheap
  -- membership lookups during re-match.
  participant_emails TEXT[] NOT NULL DEFAULT '{}',

  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  body_preview TEXT,

  sent_at TIMESTAMPTZ NOT NULL,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  attachment_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,

  matched_at TIMESTAMPTZ,
  match_attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT outlook_unmatched_emails_msg_user_unique
    UNIQUE (microsoft_message_id, sourceco_user_id)
);

CREATE INDEX IF NOT EXISTS idx_outlook_unmatched_participants
  ON public.outlook_unmatched_emails USING GIN (participant_emails)
  WHERE matched_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outlook_unmatched_pending
  ON public.outlook_unmatched_emails (sent_at DESC)
  WHERE matched_at IS NULL;

ALTER TABLE public.outlook_unmatched_emails ENABLE ROW LEVEL SECURITY;

-- Only admins (and service role, which bypasses RLS) need direct access.
DROP POLICY IF EXISTS "Admins manage outlook_unmatched_emails"
  ON public.outlook_unmatched_emails;
CREATE POLICY "Admins manage outlook_unmatched_emails"
  ON public.outlook_unmatched_emails FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Re-match helper — promotes queued emails into `email_messages`
-- ---------------------------------------------------------------------------
--    Given a set of contact ids (or, if NULL, every contact with an email),
--    look for queued unmatched emails whose `participant_emails` array
--    contains any of the contacts' addresses, and materialize them into
--    `email_messages` rows. Also attaches `deal_id` from `deal_pipeline`
--    where possible.
--
--    Returns the number of newly-materialized email_messages rows.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rematch_unmatched_outlook_emails(
  p_contact_ids UUID[] DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_materialized INTEGER := 0;
  v_promoted_msg_ids TEXT[];
BEGIN
  -- Materialize matched queue rows into `email_messages`. Each unmatched
  -- queue row fans out to one `email_messages` row per matched contact
  -- (a single thread can involve multiple contacts in our CRM).
  WITH target_contacts AS (
    SELECT c.id, LOWER(c.email) AS email
      FROM public.contacts c
     WHERE c.email IS NOT NULL
       AND c.archived = false
       AND (p_contact_ids IS NULL OR c.id = ANY(p_contact_ids))
  ),
  candidates AS (
    SELECT
      ue.*,
      tc.id AS matched_contact_id
    FROM public.outlook_unmatched_emails ue
    JOIN target_contacts tc
      ON tc.email = ANY(ue.participant_emails)
   WHERE ue.matched_at IS NULL
  ),
  inserted AS (
    INSERT INTO public.email_messages (
      microsoft_message_id,
      microsoft_conversation_id,
      contact_id,
      deal_id,
      sourceco_user_id,
      direction,
      from_address,
      to_addresses,
      cc_addresses,
      bcc_addresses,
      subject,
      body_html,
      body_text,
      sent_at,
      has_attachments,
      attachment_metadata
    )
    SELECT
      c.microsoft_message_id,
      c.microsoft_conversation_id,
      c.matched_contact_id,
      (
        SELECT dp.id
          FROM public.deal_pipeline dp
         WHERE dp.deleted_at IS NULL
           AND (
             dp.buyer_contact_id  = c.matched_contact_id
             OR dp.seller_contact_id = c.matched_contact_id
           )
         ORDER BY dp.updated_at DESC NULLS LAST
         LIMIT 1
      ),
      c.sourceco_user_id,
      c.direction,
      c.from_address,
      c.to_addresses,
      c.cc_addresses,
      '{}',
      c.subject,
      c.body_html,
      COALESCE(c.body_text, c.body_preview),
      c.sent_at,
      c.has_attachments,
      c.attachment_metadata
    FROM candidates c
    ON CONFLICT (microsoft_message_id, contact_id) DO NOTHING
    RETURNING microsoft_message_id
  )
  SELECT COUNT(*), COALESCE(ARRAY_AGG(DISTINCT microsoft_message_id), '{}')
    INTO v_materialized, v_promoted_msg_ids
    FROM inserted;

  -- Mark the queue rows whose messages were successfully promoted so the
  -- next rematch pass skips them.
  IF v_promoted_msg_ids IS NOT NULL AND array_length(v_promoted_msg_ids, 1) > 0 THEN
    UPDATE public.outlook_unmatched_emails ue
       SET matched_at = now(),
           match_attempt_count = ue.match_attempt_count + 1
     WHERE ue.matched_at IS NULL
       AND ue.microsoft_message_id = ANY(v_promoted_msg_ids);
  END IF;

  RETURN v_materialized;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rematch_unmatched_outlook_emails(UUID[])
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Lazy re-match trigger on `contacts`
-- ---------------------------------------------------------------------------
--    Fires when a contact is inserted OR when an existing contact gets a
--    (new) email. We only trigger for contacts that actually have an email
--    address — everything else is a no-op.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_rematch_outlook_on_contact_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.archived = true THEN
    RETURN NEW;
  END IF;

  PERFORM public.rematch_unmatched_outlook_emails(ARRAY[NEW.id]);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_rematch_outlook ON public.contacts;
CREATE TRIGGER trg_contacts_rematch_outlook
  AFTER INSERT OR UPDATE OF email, archived
  ON public.contacts
  FOR EACH ROW
  WHEN (NEW.email IS NOT NULL AND NEW.archived = false)
  EXECUTE FUNCTION public.trg_rematch_outlook_on_contact_change();

-- ---------------------------------------------------------------------------
-- 7. One-shot: run the re-match pass now so any previously-captured
--    unmatched emails are immediately materialized against current contacts.
--    (Safe no-op on fresh databases where the queue is empty.)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  PERFORM public.rematch_unmatched_outlook_emails(NULL);
END;
$$;

COMMIT;
