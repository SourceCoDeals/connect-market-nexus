-- =============================================================================
-- Outreach Messages Tracking (HeyReach + SmartLead)
-- =============================================================================
-- Purpose: Close the outreach blind spot — every email/LinkedIn touchpoint we
-- send through SmartLead or HeyReach, and every response, tracked at the
-- contact level. Mirrors the Outlook `email_messages` pattern but adds a
-- buyer/seller discriminator so buyer outreach anchors to the firm
-- (remarketing_buyer_id) and seller outreach anchors to the listing.
--
-- Design contract (from the feature spec):
--   - Buyer outreach     → contact_id + remarketing_buyer_id (listing_id NULL)
--   - Seller outreach    → contact_id + listing_id (remarketing_buyer_id NULL)
--   - contact_type enforces the XOR via CHECK constraint
--   - Unmatched records go to retry queues; we NEVER auto-create contacts
--   - Dedup via composite UNIQUE (external_message_id, contact_id)
--   - RLS: admin catch-all + contact_assignments SELECT (by contact_id only)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. smartlead_messages — per-email sent/event records
-- -----------------------------------------------------------------------------
-- One row per individual email event. Covers sent, opened, clicked, bounced,
-- replied, unsubscribed. Bodies stored when available (only populated for
-- sent/replied events — opens/clicks/bounces have no body).
CREATE TABLE IF NOT EXISTS public.smartlead_messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SmartLead identifiers (all three can be used for joins / debugging)
  smartlead_message_id    TEXT NOT NULL,   -- message_id from the API (dedup key, required)
  smartlead_lead_id       BIGINT,          -- SmartLead's internal lead ID
  smartlead_campaign_id   BIGINT NOT NULL, -- FK by value to smartlead_campaigns.smartlead_campaign_id

  -- Contact linkage — required; we never store messages for unmatched leads
  contact_id              UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  contact_type            TEXT NOT NULL CHECK (contact_type IN ('buyer', 'seller')),

  -- Buyer-side firm anchor — NULL for seller outreach
  remarketing_buyer_id    UUID REFERENCES public.remarketing_buyers(id) ON DELETE SET NULL,

  -- Seller-side listing anchor — NULL for buyer outreach
  listing_id              UUID REFERENCES public.listings(id) ON DELETE SET NULL,

  -- XOR: buyer rows never carry listing_id; seller rows never carry remarketing_buyer_id
  CONSTRAINT smartlead_messages_anchor_xor CHECK (
    (contact_type = 'buyer'  AND listing_id IS NULL)
    OR
    (contact_type = 'seller' AND remarketing_buyer_id IS NULL)
  ),

  direction               public.email_direction NOT NULL,
  from_address            TEXT NOT NULL,
  to_addresses            TEXT[] DEFAULT '{}',
  cc_addresses            TEXT[] DEFAULT '{}',
  subject                 TEXT,
  body_html               TEXT,
  body_text               TEXT,

  sent_at                 TIMESTAMPTZ NOT NULL,
  synced_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Event classification — same vocabulary as smartlead_webhook_events
  event_type              TEXT NOT NULL CHECK (event_type IN (
    'sent', 'opened', 'clicked', 'bounced', 'replied', 'unsubscribed'
  )),
  sequence_number         INTEGER,   -- which step in the campaign sequence
  raw_payload             JSONB,     -- full API response for forensics

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Dedup: the same message should never land twice on the same contact.
  -- smartlead_message_id is NOT NULL so a plain UNIQUE is safe.
  CONSTRAINT smartlead_messages_dedup UNIQUE (smartlead_message_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_smartlead_messages_contact
  ON public.smartlead_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_smartlead_messages_firm
  ON public.smartlead_messages(remarketing_buyer_id)
  WHERE remarketing_buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_smartlead_messages_listing
  ON public.smartlead_messages(listing_id)
  WHERE listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_smartlead_messages_sent_at
  ON public.smartlead_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_smartlead_messages_contact_sent
  ON public.smartlead_messages(contact_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_smartlead_messages_campaign
  ON public.smartlead_messages(smartlead_campaign_id);
CREATE INDEX IF NOT EXISTS idx_smartlead_messages_lead
  ON public.smartlead_messages(smartlead_lead_id)
  WHERE smartlead_lead_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 2. heyreach_messages — per-LinkedIn-message records
-- -----------------------------------------------------------------------------
-- One row per individual LinkedIn event. Covers connection requests, messages,
-- InMails, and replies. Body is always populated when the event has a body.
CREATE TABLE IF NOT EXISTS public.heyreach_messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- HeyReach identifiers
  heyreach_message_id     TEXT NOT NULL,   -- conversation message ID (dedup key, required)
  heyreach_lead_id        TEXT,            -- HeyReach's lead ID (string in their API)
  heyreach_campaign_id    BIGINT NOT NULL, -- FK by value to heyreach_campaigns.heyreach_campaign_id

  -- Contact linkage — required
  contact_id              UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  contact_type            TEXT NOT NULL CHECK (contact_type IN ('buyer', 'seller')),

  remarketing_buyer_id    UUID REFERENCES public.remarketing_buyers(id) ON DELETE SET NULL,
  listing_id              UUID REFERENCES public.listings(id) ON DELETE SET NULL,

  CONSTRAINT heyreach_messages_anchor_xor CHECK (
    (contact_type = 'buyer'  AND listing_id IS NULL)
    OR
    (contact_type = 'seller' AND remarketing_buyer_id IS NULL)
  ),

  direction               public.email_direction NOT NULL,  -- reused: inbound = received, outbound = sent

  -- LinkedIn-specific addressing
  from_linkedin_url       TEXT,
  to_linkedin_url         TEXT,

  message_type            TEXT NOT NULL CHECK (message_type IN (
    'connection_request', 'message', 'inmail', 'profile_view'
  )),
  subject                 TEXT,   -- used for InMails
  body_text               TEXT,

  sent_at                 TIMESTAMPTZ NOT NULL,
  synced_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Event classification — matches heyreach-webhook event vocabulary
  event_type              TEXT NOT NULL CHECK (event_type IN (
    'connection_request_sent',
    'connection_request_accepted',
    'message_sent',
    'message_received',
    'inmail_sent',
    'inmail_received',
    'lead_replied',
    'lead_interested',
    'lead_not_interested',
    'profile_viewed'
  )),
  raw_payload             JSONB,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT heyreach_messages_dedup UNIQUE (heyreach_message_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_heyreach_messages_contact
  ON public.heyreach_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_heyreach_messages_firm
  ON public.heyreach_messages(remarketing_buyer_id)
  WHERE remarketing_buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_heyreach_messages_listing
  ON public.heyreach_messages(listing_id)
  WHERE listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_heyreach_messages_sent_at
  ON public.heyreach_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_heyreach_messages_contact_sent
  ON public.heyreach_messages(contact_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_heyreach_messages_campaign
  ON public.heyreach_messages(heyreach_campaign_id);
CREATE INDEX IF NOT EXISTS idx_heyreach_messages_lead
  ON public.heyreach_messages(heyreach_lead_id)
  WHERE heyreach_lead_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 3. smartlead_unmatched_messages — retry queue for orphan records
-- -----------------------------------------------------------------------------
-- When a SmartLead event arrives for a lead we can't match to an existing
-- contact, we park the full payload here instead of auto-creating the contact.
-- A later resolver can re-attempt matching (e.g. after a new contact is added).
CREATE TABLE IF NOT EXISTS public.smartlead_unmatched_messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  smartlead_message_id    TEXT,
  smartlead_lead_id       BIGINT,
  smartlead_campaign_id   BIGINT,

  -- Match signals we captured (for later resolution)
  lead_email              TEXT,
  lead_linkedin_url       TEXT,
  lead_first_name         TEXT,
  lead_last_name          TEXT,
  lead_company_name       TEXT,

  direction               public.email_direction,
  from_address            TEXT,
  to_addresses            TEXT[],
  subject                 TEXT,
  body_html               TEXT,
  body_text               TEXT,
  sent_at                 TIMESTAMPTZ,
  event_type              TEXT,
  sequence_number         INTEGER,
  raw_payload             JSONB,

  reason                  TEXT,    -- 'no_match' | 'unsupported_contact_type' | 'missing_anchor' | 'missing_identifiers'
  match_attempt_count     INTEGER NOT NULL DEFAULT 1,
  last_attempted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  matched_at              TIMESTAMPTZ,  -- set when the record is promoted
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- NULLS NOT DISTINCT so two rows with (NULL, 'x@y.com') collapse instead of
  -- accumulating duplicates across sync runs. Requires PostgreSQL 15+
  -- (already used elsewhere in this project).
  CONSTRAINT smartlead_unmatched_dedup UNIQUE NULLS NOT DISTINCT (smartlead_message_id, lead_email)
);

CREATE INDEX IF NOT EXISTS idx_smartlead_unmatched_email
  ON public.smartlead_unmatched_messages(lower(lead_email))
  WHERE lead_email IS NOT NULL AND matched_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_smartlead_unmatched_pending
  ON public.smartlead_unmatched_messages(created_at DESC)
  WHERE matched_at IS NULL;


-- -----------------------------------------------------------------------------
-- 4. heyreach_unmatched_messages — retry queue for orphan LinkedIn records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.heyreach_unmatched_messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  heyreach_message_id     TEXT,
  heyreach_lead_id        TEXT,
  heyreach_campaign_id    BIGINT,

  lead_linkedin_url       TEXT,    -- primary match signal
  lead_email              TEXT,    -- secondary match signal
  lead_first_name         TEXT,
  lead_last_name          TEXT,
  lead_company_name       TEXT,

  direction               public.email_direction,
  from_linkedin_url       TEXT,
  to_linkedin_url         TEXT,
  message_type            TEXT,
  subject                 TEXT,
  body_text               TEXT,
  sent_at                 TIMESTAMPTZ,
  event_type              TEXT,
  raw_payload             JSONB,

  reason                  TEXT,
  match_attempt_count     INTEGER NOT NULL DEFAULT 1,
  last_attempted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  matched_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT heyreach_unmatched_dedup UNIQUE NULLS NOT DISTINCT (heyreach_message_id, lead_linkedin_url)
);

CREATE INDEX IF NOT EXISTS idx_heyreach_unmatched_linkedin
  ON public.heyreach_unmatched_messages(lower(lead_linkedin_url))
  WHERE lead_linkedin_url IS NOT NULL AND matched_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_heyreach_unmatched_email
  ON public.heyreach_unmatched_messages(lower(lead_email))
  WHERE lead_email IS NOT NULL AND matched_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_heyreach_unmatched_pending
  ON public.heyreach_unmatched_messages(created_at DESC)
  WHERE matched_at IS NULL;


-- -----------------------------------------------------------------------------
-- 5. outreach_sync_state — per-campaign high-water-mark tracker
-- -----------------------------------------------------------------------------
-- Lets each sync worker resume from where it left off instead of re-scanning
-- full campaign histories on every run. One row per (channel, campaign).
CREATE TABLE IF NOT EXISTS public.outreach_sync_state (
  channel                 TEXT NOT NULL CHECK (channel IN ('smartlead', 'heyreach')),
  external_campaign_id    BIGINT NOT NULL,
  last_synced_at          TIMESTAMPTZ,                 -- cutoff for "what's new"
  last_synced_message_id  TEXT,                        -- safety net for same-second messages
  last_sync_attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status             TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'running', 'ok', 'error')),
  error_message           TEXT,
  messages_synced_total   BIGINT NOT NULL DEFAULT 0,   -- cumulative counter
  PRIMARY KEY (channel, external_campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_outreach_sync_state_channel_status
  ON public.outreach_sync_state(channel, sync_status);


-- =============================================================================
-- RLS — copied from the Outlook email_messages pattern
-- =============================================================================
-- Two policies on each message table:
--   1. Admins can do anything (catch-all via public.is_admin)
--   2. Non-admin users can SELECT rows for contacts they're assigned to
--
-- Service role bypasses RLS entirely, so sync workers (which use the service
-- role client) write without friction.
-- =============================================================================

ALTER TABLE public.smartlead_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heyreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smartlead_unmatched_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heyreach_unmatched_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sync_state ENABLE ROW LEVEL SECURITY;

-- smartlead_messages
DROP POLICY IF EXISTS "Admins manage smartlead_messages" ON public.smartlead_messages;
CREATE POLICY "Admins manage smartlead_messages"
  ON public.smartlead_messages FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users view assigned smartlead_messages" ON public.smartlead_messages;
CREATE POLICY "Users view assigned smartlead_messages"
  ON public.smartlead_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contact_assignments ca
      WHERE ca.sourceco_user_id = auth.uid()
        AND ca.is_active = true
        AND ca.contact_id = smartlead_messages.contact_id
    )
  );

-- heyreach_messages
DROP POLICY IF EXISTS "Admins manage heyreach_messages" ON public.heyreach_messages;
CREATE POLICY "Admins manage heyreach_messages"
  ON public.heyreach_messages FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users view assigned heyreach_messages" ON public.heyreach_messages;
CREATE POLICY "Users view assigned heyreach_messages"
  ON public.heyreach_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contact_assignments ca
      WHERE ca.sourceco_user_id = auth.uid()
        AND ca.is_active = true
        AND ca.contact_id = heyreach_messages.contact_id
    )
  );

-- Unmatched queues — admin only (no contact_id yet to check against)
DROP POLICY IF EXISTS "Admins manage smartlead_unmatched_messages" ON public.smartlead_unmatched_messages;
CREATE POLICY "Admins manage smartlead_unmatched_messages"
  ON public.smartlead_unmatched_messages FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage heyreach_unmatched_messages" ON public.heyreach_unmatched_messages;
CREATE POLICY "Admins manage heyreach_unmatched_messages"
  ON public.heyreach_unmatched_messages FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Sync state — admin only
DROP POLICY IF EXISTS "Admins manage outreach_sync_state" ON public.outreach_sync_state;
CREATE POLICY "Admins manage outreach_sync_state"
  ON public.outreach_sync_state FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- =============================================================================
-- Grants
-- =============================================================================
GRANT SELECT ON public.smartlead_messages TO authenticated;
GRANT SELECT ON public.heyreach_messages TO authenticated;
GRANT ALL    ON public.smartlead_messages TO service_role;
GRANT ALL    ON public.heyreach_messages TO service_role;
GRANT ALL    ON public.smartlead_unmatched_messages TO service_role;
GRANT ALL    ON public.heyreach_unmatched_messages TO service_role;
GRANT ALL    ON public.outreach_sync_state TO service_role;


-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE public.smartlead_messages IS
  'Per-email sent/response records synced from SmartLead. Mirrors email_messages. '
  'Buyer outreach rows carry remarketing_buyer_id (firm); seller outreach rows carry listing_id. '
  'XOR enforced via CHECK constraint.';

COMMENT ON TABLE public.heyreach_messages IS
  'Per-LinkedIn-message records synced from HeyReach. Same buyer/seller anchor model '
  'as smartlead_messages.';

COMMENT ON TABLE public.smartlead_unmatched_messages IS
  'Retry queue for SmartLead events we could not match to an existing contact. '
  'Never auto-create contacts — records here are resolved manually or by a '
  'promotion job when a matching contact is added.';

COMMENT ON TABLE public.heyreach_unmatched_messages IS
  'Retry queue for HeyReach events we could not match to an existing contact.';

COMMENT ON TABLE public.outreach_sync_state IS
  'Per-campaign high-water-mark for sync workers. One row per (channel, external_campaign_id). '
  'Workers read last_synced_at to know what is new and update it on success.';
