-- ============================================================================
-- MIGRATION: Add buyer_contact_id + seller_contact_id to deals table
-- ============================================================================
-- Part of the Data Relationship Audit — closes the three missing FKs on deals:
--   1. buyer_contact_id  → contacts (the buyer person working this deal)
--   2. seller_contact_id → contacts (the seller/owner being worked)
--   (remarketing_buyer_id already exists from 20260220220000)
--
-- Also backfills both columns from existing data:
--   - seller_contact_id: matched via listing_id + contact_type='seller'
--   - buyer_contact_id: matched via connection_requests.user_id → contacts.profile_id
--   - remarketing_buyer_id: derived from buyer contact's remarketing_buyer_id
--
-- SAFETY:
--   - ADDITIVE ONLY: Two new nullable UUID columns + indexes.
--   - NO DATA LOSS: Existing deals unchanged except for backfill of new columns.
--   - ZERO DOWNTIME: All statements are safe for live production.
-- ============================================================================


-- ─── STEP 1: Add FK columns ─────────────────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS buyer_contact_id
    UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_contact_id
    UUID REFERENCES public.contacts(id) ON DELETE SET NULL;


-- ─── STEP 2: Partial indexes for efficient lookups ───────────────────────────

CREATE INDEX IF NOT EXISTS idx_deals_buyer_contact
  ON public.deals(buyer_contact_id)
  WHERE buyer_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_seller_contact
  ON public.deals(seller_contact_id)
  WHERE seller_contact_id IS NOT NULL;


-- ─── STEP 3: Backfill seller_contact_id ──────────────────────────────────────
-- Match deals to seller contacts via the deal's listing_id.
-- Each listing has a primary seller contact in the contacts table.

UPDATE public.deals d
SET seller_contact_id = c.id
FROM public.contacts c
WHERE d.seller_contact_id IS NULL
  AND d.listing_id IS NOT NULL
  AND c.listing_id = d.listing_id
  AND c.contact_type = 'seller'
  AND c.is_primary_seller_contact = true
  AND c.archived = false;

-- Fallback: if no primary seller contact, try matching by email
UPDATE public.deals d
SET seller_contact_id = c.id
FROM public.contacts c
WHERE d.seller_contact_id IS NULL
  AND d.contact_email IS NOT NULL
  AND lower(d.contact_email) = lower(c.email)
  AND c.contact_type = 'seller'
  AND c.archived = false;


-- ─── STEP 4: Backfill buyer_contact_id ───────────────────────────────────────
-- For marketplace-originated deals (via connection_request + user_id):
-- Match the requesting user's profile to a buyer contact via contacts.profile_id.

UPDATE public.deals d
SET buyer_contact_id = c.id
FROM public.connection_requests cr
JOIN public.contacts c ON c.profile_id = cr.user_id AND c.contact_type = 'buyer'
WHERE d.connection_request_id = cr.id
  AND d.buyer_contact_id IS NULL
  AND cr.user_id IS NOT NULL
  AND c.archived = false;


-- ─── STEP 5: Backfill remarketing_buyer_id from buyer contact ────────────────
-- For deals that now have a buyer_contact_id but no remarketing_buyer_id,
-- derive the org from the contact's remarketing_buyer_id.

UPDATE public.deals d
SET remarketing_buyer_id = c.remarketing_buyer_id
FROM public.contacts c
WHERE d.buyer_contact_id = c.id
  AND d.remarketing_buyer_id IS NULL
  AND c.remarketing_buyer_id IS NOT NULL;


-- ============================================================================
-- Summary:
--   2 new columns: buyer_contact_id, seller_contact_id (nullable UUID FKs)
--   2 partial indexes for efficient lookups
--   3 backfill passes: seller by listing, buyer by connection_request, org by contact
--   Existing remarketing_buyer_id column untouched (already exists)
-- ============================================================================
