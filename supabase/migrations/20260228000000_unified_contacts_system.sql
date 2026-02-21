-- ============================================================================
-- MIGRATION: Unified Contacts System
-- ============================================================================
-- Creates a unified contacts table covering all people across the platform:
-- buyer contacts, seller contacts, marketplace users, advisors.
--
-- Also links remarketing_buyers to firm_agreements via the existing
-- marketplace_firm_id column (already present — no new column needed).
--
-- Backfills contacts from:
--   1. remarketing_buyer_contacts → buyer contacts
--   2. profiles (approved marketplace users) → buyer contacts (deduplicated)
--   3. listings (seller contact fields) → seller contacts
--
-- Creates trigger to keep listings flat fields in sync with primary seller contact.
-- ============================================================================


-- ============================================================================
-- STEP 1: Ensure remarketing_buyers → firm_agreements link is indexed
-- ============================================================================
-- The marketplace_firm_id FK already exists (from 20260219200000_unify_fee_agreements.sql).
-- Just ensure the index exists and run a second-pass match for any buyers added since
-- that migration ran.

CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_marketplace_firm_id
  ON public.remarketing_buyers(marketplace_firm_id)
  WHERE marketplace_firm_id IS NOT NULL;

-- Second-pass: match any unlinked buyers by email_domain or website
UPDATE public.remarketing_buyers rb
SET marketplace_firm_id = fa.id
FROM public.firm_agreements fa
WHERE rb.marketplace_firm_id IS NULL
  AND rb.archived = false
  AND (
    -- Match by email domain
    (rb.email_domain IS NOT NULL AND rb.email_domain != ''
     AND fa.email_domain IS NOT NULL AND fa.email_domain != ''
     AND lower(rb.email_domain) = lower(fa.email_domain))
    OR
    -- Match by website domain
    (rb.company_website IS NOT NULL AND fa.website_domain IS NOT NULL
     AND fa.website_domain != ''
     AND lower(trim(trailing '/' from regexp_replace(
           regexp_replace(rb.company_website, '^https?://', ''), '^www\.', '')))
        = lower(fa.website_domain))
  );


-- ============================================================================
-- STEP 2: Create contacts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  title TEXT,
  contact_type TEXT NOT NULL DEFAULT 'buyer'
    CHECK (contact_type IN ('buyer', 'seller', 'advisor', 'internal')),

  -- Firm link (nullable — individual buyers may have no firm)
  firm_id UUID REFERENCES public.firm_agreements(id) ON DELETE SET NULL,

  -- Remarketing buyer link (the org-level buyer record)
  remarketing_buyer_id UUID REFERENCES public.remarketing_buyers(id) ON DELETE SET NULL,

  -- Primary contact flag at firm level
  is_primary_at_firm BOOLEAN DEFAULT false,

  -- Marketplace user link (nullable — not all contacts are platform users)
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Seller-specific: which deal this seller contact belongs to
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  is_primary_seller_contact BOOLEAN DEFAULT false,

  -- Individual-level agreement status (used when no firm or for individual overrides)
  nda_signed BOOLEAN DEFAULT false,
  nda_signed_at TIMESTAMPTZ,
  fee_agreement_signed BOOLEAN DEFAULT false,
  fee_agreement_signed_at TIMESTAMPTZ,

  -- Metadata
  source TEXT DEFAULT 'manual',
  notes TEXT,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraints for ON CONFLICT clauses
-- Buyer contacts: one record per email (across all firms)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_buyer_email_unique
  ON public.contacts(lower(email))
  WHERE contact_type = 'buyer' AND email IS NOT NULL AND archived = false;

-- Seller contacts: one record per email per deal
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_seller_email_listing_unique
  ON public.contacts(lower(email), listing_id)
  WHERE contact_type = 'seller' AND email IS NOT NULL AND archived = false;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_contacts_firm
  ON public.contacts(firm_id) WHERE firm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_buyer
  ON public.contacts(remarketing_buyer_id) WHERE remarketing_buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_profile
  ON public.contacts(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_listing
  ON public.contacts(listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email
  ON public.contacts(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_type
  ON public.contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_type_active
  ON public.contacts(contact_type, archived) WHERE archived = false;

-- RLS: admin-only
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_admin_all" ON public.contacts;
CREATE POLICY "contacts_admin_all" ON public.contacts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

DROP POLICY IF EXISTS "contacts_service_role" ON public.contacts;
CREATE POLICY "contacts_service_role" ON public.contacts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Grants
GRANT ALL ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

COMMENT ON TABLE public.contacts IS
  'Unified contact identity for all people across the platform. '
  'Every person is a contact. Buyer contacts have firm_id and/or remarketing_buyer_id. '
  'Seller contacts have listing_id. Marketplace users have profile_id. '
  'Agreement status resolved from both firm_agreements (firm-level) and contacts (individual-level).';


-- ============================================================================
-- STEP 3: Backfill buyer contacts from remarketing_buyer_contacts
-- ============================================================================
-- Maps existing remarketing_buyer_contacts rows to the new contacts table.
-- Uses marketplace_firm_id from the parent remarketing_buyers record.

INSERT INTO public.contacts
  (first_name, last_name, email, phone, linkedin_url, title,
   contact_type, remarketing_buyer_id, firm_id,
   is_primary_at_firm, source, notes, created_at)
SELECT
  COALESCE(NULLIF(TRIM(split_part(rbc.name, ' ', 1)), ''), rbc.name, 'Unknown'),
  CASE WHEN position(' ' IN COALESCE(rbc.name, '')) > 0
       THEN TRIM(substring(rbc.name FROM position(' ' IN rbc.name) + 1))
       ELSE '' END,
  NULLIF(TRIM(lower(rbc.email)), ''),
  NULLIF(TRIM(rbc.phone), ''),
  NULLIF(TRIM(rbc.linkedin_url), ''),
  NULLIF(TRIM(rbc.role), ''),
  'buyer',
  rbc.buyer_id,
  rb.marketplace_firm_id,
  COALESCE(rbc.is_primary, false),
  COALESCE(rbc.source, 'migration'),
  rbc.notes,
  rbc.created_at
FROM public.remarketing_buyer_contacts rbc
JOIN public.remarketing_buyers rb ON rb.id = rbc.buyer_id
ON CONFLICT DO NOTHING;


-- ============================================================================
-- STEP 4: Backfill marketplace profiles as buyer contacts
-- ============================================================================
-- For approved profiles: insert new contact or merge with existing (by email).
-- Resolves firm_id through firm_members → firm_agreements.

INSERT INTO public.contacts
  (first_name, last_name, email, phone, linkedin_url, title,
   contact_type, profile_id, firm_id,
   nda_signed, nda_signed_at, fee_agreement_signed, fee_agreement_signed_at,
   source, created_at)
SELECT
  COALESCE(NULLIF(TRIM(p.first_name), ''), 'Unknown'),
  COALESCE(NULLIF(TRIM(p.last_name), ''), ''),
  lower(TRIM(p.email)),
  NULLIF(TRIM(p.phone_number), ''),
  NULLIF(TRIM(p.linkedin_profile), ''),
  NULLIF(TRIM(p.job_title), ''),
  'buyer',
  p.id,
  fm_lookup.firm_id,
  COALESCE(p.nda_signed, false),
  p.nda_signed_at,
  COALESCE(p.fee_agreement_signed, false),
  p.fee_agreement_signed_at,
  'marketplace_signup',
  p.created_at
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT fm.firm_id
  FROM public.firm_members fm
  WHERE fm.user_id = p.id
  LIMIT 1
) fm_lookup ON true
WHERE p.approval_status = 'approved'
  AND p.email IS NOT NULL
  AND TRIM(p.email) != ''
ON CONFLICT (lower(email)) WHERE contact_type = 'buyer' AND email IS NOT NULL AND archived = false
  DO UPDATE SET
    profile_id = EXCLUDED.profile_id,
    firm_id = COALESCE(contacts.firm_id, EXCLUDED.firm_id),
    nda_signed = COALESCE(EXCLUDED.nda_signed, contacts.nda_signed),
    nda_signed_at = COALESCE(EXCLUDED.nda_signed_at, contacts.nda_signed_at),
    fee_agreement_signed = COALESCE(EXCLUDED.fee_agreement_signed, contacts.fee_agreement_signed),
    fee_agreement_signed_at = COALESCE(EXCLUDED.fee_agreement_signed_at, contacts.fee_agreement_signed_at),
    updated_at = now();


-- ============================================================================
-- STEP 5: Backfill seller contacts from listings
-- ============================================================================
-- Every listing with a main_contact_name becomes a seller contact.

INSERT INTO public.contacts
  (first_name, last_name, email, phone, title,
   contact_type, listing_id, is_primary_seller_contact, source, created_at)
SELECT
  COALESCE(
    NULLIF(TRIM(split_part(l.main_contact_name, ' ', 1)), ''),
    l.main_contact_name,
    'Unknown'
  ),
  CASE WHEN position(' ' IN COALESCE(l.main_contact_name, '')) > 0
       THEN TRIM(substring(l.main_contact_name FROM position(' ' IN l.main_contact_name) + 1))
       ELSE '' END,
  NULLIF(TRIM(lower(l.main_contact_email)), ''),
  NULLIF(TRIM(l.main_contact_phone), ''),
  NULLIF(TRIM(l.main_contact_title), ''),
  'seller',
  l.id,
  true,
  'migration',
  l.created_at
FROM public.listings l
WHERE l.main_contact_name IS NOT NULL
  AND TRIM(l.main_contact_name) != ''
ON CONFLICT (lower(email), listing_id) WHERE contact_type = 'seller' AND email IS NOT NULL AND archived = false
  DO NOTHING;


-- ============================================================================
-- STEP 6: Trigger — sync primary seller contact back to listings flat fields
-- ============================================================================
-- When a seller contact is set as primary, update the denormalized fields on listings.
-- This keeps existing queries that read main_contact_* working without changes.

CREATE OR REPLACE FUNCTION public.sync_primary_seller_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on seller contacts that are primary and have a listing
  IF NEW.is_primary_seller_contact = true AND NEW.listing_id IS NOT NULL THEN
    -- Unset any other primary contacts for this listing
    UPDATE public.contacts
    SET is_primary_seller_contact = false, updated_at = now()
    WHERE listing_id = NEW.listing_id
      AND id != NEW.id
      AND is_primary_seller_contact = true
      AND contact_type = 'seller';

    -- Sync to listings flat fields
    UPDATE public.listings
    SET
      main_contact_name = TRIM(NEW.first_name || ' ' || NEW.last_name),
      main_contact_email = NEW.email,
      main_contact_phone = NEW.phone,
      main_contact_title = NEW.title,
      updated_at = now()
    WHERE id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_seller_contact ON public.contacts;
CREATE TRIGGER trg_sync_seller_contact
  AFTER INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  WHEN (NEW.contact_type = 'seller' AND NEW.is_primary_seller_contact = true)
  EXECUTE FUNCTION public.sync_primary_seller_contact();


-- ============================================================================
-- Summary
-- ============================================================================
-- 1 new table: contacts (unified contact identity)
-- 1 trigger: trg_sync_seller_contact (keeps listings flat fields in sync)
-- 2 unique indexes for deduplication (buyer by email, seller by email+listing)
-- 7 performance indexes
-- Backfilled from: remarketing_buyer_contacts, profiles, listings
-- No existing tables dropped or columns removed.
-- ============================================================================
