-- Drop existing function first to allow return type change
DROP FUNCTION IF EXISTS public.get_deal_access_matrix(uuid);

-- ============================================================================
-- MIGRATION: Contact-Level Document Tracking
-- ============================================================================

-- STEP 1: Extend data_room_access
ALTER TABLE public.data_room_access
  DROP CONSTRAINT IF EXISTS data_room_access_one_buyer_type;

ALTER TABLE public.data_room_access
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;

UPDATE public.data_room_access
SET access_token = gen_random_uuid()
WHERE access_token IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_data_room_access_token'
  ) THEN
    CREATE UNIQUE INDEX idx_data_room_access_token ON public.data_room_access(access_token);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'data_room_access_has_identity'
  ) THEN
    ALTER TABLE public.data_room_access
      ADD CONSTRAINT data_room_access_has_identity CHECK (
        contact_id IS NOT NULL
        OR remarketing_buyer_id IS NOT NULL
        OR marketplace_user_id IS NOT NULL
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_data_room_access_contact
  ON public.data_room_access(contact_id) WHERE contact_id IS NOT NULL;

UPDATE public.data_room_access dra
SET contact_id = c.id
FROM public.contacts c
WHERE dra.contact_id IS NULL
  AND dra.remarketing_buyer_id IS NOT NULL
  AND c.remarketing_buyer_id = dra.remarketing_buyer_id
  AND c.is_primary_at_firm = true
  AND c.contact_type = 'buyer'
  AND c.archived = false;

UPDATE public.data_room_access dra
SET contact_id = sub.contact_id
FROM (
  SELECT DISTINCT ON (dra2.id) dra2.id AS access_id, c2.id AS contact_id
  FROM public.data_room_access dra2
  JOIN public.contacts c2
    ON c2.remarketing_buyer_id = dra2.remarketing_buyer_id
    AND c2.contact_type = 'buyer'
    AND c2.archived = false
  WHERE dra2.contact_id IS NULL
    AND dra2.remarketing_buyer_id IS NOT NULL
  ORDER BY dra2.id, c2.created_at ASC
) sub
WHERE dra.id = sub.access_id;

UPDATE public.data_room_access dra
SET contact_id = c.id
FROM public.contacts c
WHERE dra.contact_id IS NULL
  AND dra.marketplace_user_id IS NOT NULL
  AND c.profile_id = dra.marketplace_user_id
  AND c.contact_type = 'buyer'
  AND c.archived = false;

-- STEP 2: Add contact_id to remarketing_outreach
ALTER TABLE public.remarketing_outreach
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_contact
  ON public.remarketing_outreach(contact_id) WHERE contact_id IS NOT NULL;

UPDATE public.remarketing_outreach ro
SET contact_id = c.id
FROM public.contacts c
WHERE ro.contact_id IS NULL
  AND c.remarketing_buyer_id = ro.buyer_id
  AND c.is_primary_at_firm = true
  AND c.contact_type = 'buyer'
  AND c.archived = false;

UPDATE public.remarketing_outreach ro
SET contact_id = sub.contact_id
FROM (
  SELECT DISTINCT ON (ro2.id) ro2.id AS outreach_id, c2.id AS contact_id
  FROM public.remarketing_outreach ro2
  JOIN public.contacts c2
    ON c2.remarketing_buyer_id = ro2.buyer_id
    AND c2.contact_type = 'buyer'
    AND c2.archived = false
  WHERE ro2.contact_id IS NULL
  ORDER BY ro2.id, c2.created_at ASC
) sub
WHERE ro.id = sub.outreach_id;

-- STEP 3: Add contact_id to document_tracked_links
ALTER TABLE public.document_tracked_links
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tracked_links_contact
  ON public.document_tracked_links(contact_id) WHERE contact_id IS NOT NULL;

-- STEP 4: Add contact_id to document_release_log + make document_id nullable
ALTER TABLE public.document_release_log
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.document_release_log
  ALTER COLUMN document_id DROP NOT NULL;

ALTER TABLE public.document_release_log
  ALTER COLUMN buyer_email DROP NOT NULL;

ALTER TABLE public.document_release_log
  ALTER COLUMN released_by DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_release_log_contact
  ON public.document_release_log(contact_id) WHERE contact_id IS NOT NULL;

-- STEP 5: Add status column to data_room_documents
ALTER TABLE public.data_room_documents
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'data_room_documents_status_check'
  ) THEN
    ALTER TABLE public.data_room_documents
      ADD CONSTRAINT data_room_documents_status_check
      CHECK (status IN ('active', 'archived', 'deleted'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_data_room_documents_status
  ON public.data_room_documents(deal_id, status) WHERE status = 'active';

-- STEP 6: Migrate memo_distribution_log → document_release_log
INSERT INTO public.document_release_log
  (deal_id, document_id, buyer_id, buyer_name, buyer_firm,
   buyer_email, release_method, released_by, released_at,
   release_notes, contact_id)
SELECT
  mdl.deal_id,
  NULL,
  COALESCE(mdl.remarketing_buyer_id, mdl.marketplace_user_id),
  COALESCE(rb.company_name, p_buyer.first_name || ' ' || p_buyer.last_name, mdl.channel, 'Unknown'),
  COALESCE(rb.pe_firm_name, p_buyer.company_name),
  mdl.email_address,
  CASE mdl.channel
    WHEN 'email' THEN 'tracked_link'
    WHEN 'platform' THEN 'tracked_link'
    WHEN 'manual_log' THEN 'pdf_download'
    ELSE 'pdf_download'
  END,
  CASE WHEN p_sender.id IS NOT NULL THEN mdl.sent_by ELSE NULL END,
  mdl.sent_at,
  mdl.notes,
  COALESCE(c_primary.id, c_any.id, c_marketplace.id)
FROM public.memo_distribution_log mdl
LEFT JOIN public.remarketing_buyers rb ON rb.id = mdl.remarketing_buyer_id
LEFT JOIN public.profiles p_buyer ON p_buyer.id = mdl.marketplace_user_id AND mdl.remarketing_buyer_id IS NULL
LEFT JOIN public.profiles p_sender ON p_sender.id = mdl.sent_by
LEFT JOIN public.contacts c_primary
  ON c_primary.remarketing_buyer_id = mdl.remarketing_buyer_id
  AND c_primary.is_primary_at_firm = true
  AND c_primary.contact_type = 'buyer'
  AND c_primary.archived = false
LEFT JOIN LATERAL (
  SELECT c2.id FROM public.contacts c2
  WHERE c2.remarketing_buyer_id = mdl.remarketing_buyer_id
    AND c2.contact_type = 'buyer'
    AND c2.archived = false
  ORDER BY c2.created_at ASC
  LIMIT 1
) c_any ON c_primary.id IS NULL AND mdl.remarketing_buyer_id IS NOT NULL
LEFT JOIN public.contacts c_marketplace
  ON c_marketplace.profile_id = mdl.marketplace_user_id
  AND c_marketplace.contact_type = 'buyer'
  AND c_marketplace.archived = false
  AND mdl.remarketing_buyer_id IS NULL
  AND mdl.marketplace_user_id IS NOT NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_release_log drl
  WHERE drl.deal_id = mdl.deal_id
    AND drl.released_at = mdl.sent_at
    AND drl.buyer_email IS NOT DISTINCT FROM mdl.email_address
    AND drl.release_notes IS NOT DISTINCT FROM mdl.notes
);

-- STEP 7: Agreement status resolution RPC
CREATE OR REPLACE FUNCTION public.resolve_contact_agreement_status(p_contact_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact contacts%ROWTYPE;
  v_firm    firm_agreements%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_firm_nda BOOLEAN;
  v_firm_fee BOOLEAN;
  v_individual_nda BOOLEAN;
  v_individual_fee BOOLEAN;
BEGIN
  SELECT * INTO v_contact FROM contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Contact not found');
  END IF;

  v_firm_nda := false;
  v_firm_fee := false;

  IF v_contact.firm_id IS NOT NULL THEN
    SELECT * INTO v_firm FROM firm_agreements WHERE id = v_contact.firm_id;
    IF FOUND THEN
      v_firm_nda := COALESCE(v_firm.nda_status = 'signed', false)
                    AND (v_firm.nda_expires_at IS NULL OR v_firm.nda_expires_at > now());
      v_firm_fee := COALESCE(v_firm.fee_agreement_status = 'signed', false)
                    AND (v_firm.fee_agreement_expires_at IS NULL OR v_firm.fee_agreement_expires_at > now());
    END IF;
  END IF;

  v_individual_nda := COALESCE(v_contact.nda_signed, false);
  v_individual_fee := COALESCE(v_contact.fee_agreement_signed, false);

  IF v_contact.profile_id IS NOT NULL THEN
    SELECT * INTO v_profile FROM profiles WHERE id = v_contact.profile_id;
    IF FOUND THEN
      v_individual_nda := COALESCE(v_profile.nda_signed, v_contact.nda_signed, false);
      v_individual_fee := COALESCE(v_profile.fee_agreement_signed, v_contact.fee_agreement_signed, false);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'contact_id', p_contact_id,
    'contact_name', TRIM(v_contact.first_name || ' ' || v_contact.last_name),
    'firm_id', v_contact.firm_id,
    'firm_name', v_firm.primary_company_name,
    'firm_nda', v_firm_nda,
    'firm_nda_status', v_firm.nda_status,
    'firm_nda_at', v_firm.nda_signed_at,
    'firm_fee', v_firm_fee,
    'firm_fee_status', v_firm.fee_agreement_status,
    'firm_fee_at', v_firm.fee_agreement_signed_at,
    'individual_nda', v_individual_nda,
    'individual_nda_at', COALESCE(v_profile.nda_signed_at, v_contact.nda_signed_at),
    'individual_fee', v_individual_fee,
    'individual_fee_at', COALESCE(v_profile.fee_agreement_signed_at, v_contact.fee_agreement_signed_at),
    'effective_nda', v_firm_nda OR v_individual_nda,
    'effective_fee', v_firm_fee OR v_individual_fee
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_contact_agreement_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_contact_agreement_status TO service_role;

-- STEP 8: Update get_deal_access_matrix to include contact info
CREATE OR REPLACE FUNCTION public.get_deal_access_matrix(p_deal_id UUID)
RETURNS TABLE (
  access_id UUID,
  remarketing_buyer_id UUID,
  marketplace_user_id UUID,
  contact_id UUID,
  buyer_name TEXT,
  buyer_company TEXT,
  contact_title TEXT,
  can_view_teaser BOOLEAN,
  can_view_full_memo BOOLEAN,
  can_view_data_room BOOLEAN,
  fee_agreement_signed BOOLEAN,
  fee_agreement_override BOOLEAN,
  fee_agreement_override_reason TEXT,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ,
  access_token UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS access_id,
    a.remarketing_buyer_id,
    a.marketplace_user_id,
    a.contact_id,
    COALESCE(
      NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''),
      rb.company_name,
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      p.email
    ) AS buyer_name,
    COALESCE(
      fa.primary_company_name,
      rb.pe_firm_name,
      rb.company_name
    ) AS buyer_company,
    c.title AS contact_title,
    a.can_view_teaser,
    a.can_view_full_memo,
    a.can_view_data_room,
    COALESCE(
      (SELECT fac.fee_agreement_status = 'signed'
       FROM public.firm_agreements fac
       WHERE fac.id = c.firm_id
       LIMIT 1),
      (SELECT fal.fee_agreement_status = 'signed'
       FROM public.firm_agreements fal
       WHERE (fal.email_domain = rb.email_domain OR fal.website_domain IS NOT NULL)
         AND rb.email_domain IS NOT NULL
         AND fal.email_domain = rb.email_domain
       LIMIT 1),
      false
    ) AS fee_agreement_signed,
    a.fee_agreement_override,
    a.fee_agreement_override_reason,
    a.granted_at,
    a.revoked_at,
    a.expires_at,
    COALESCE(
      a.last_access_at,
      (SELECT MAX(al.created_at) FROM public.data_room_audit_log al
       WHERE al.deal_id = a.deal_id
         AND al.user_id = COALESCE(a.marketplace_user_id, a.remarketing_buyer_id::uuid)
         AND al.action IN ('view_document', 'download_document', 'view_data_room'))
    ) AS last_access_at,
    a.access_token
  FROM public.data_room_access a
  LEFT JOIN public.contacts c ON c.id = a.contact_id
  LEFT JOIN public.firm_agreements fa ON fa.id = c.firm_id
  LEFT JOIN public.remarketing_buyers rb ON rb.id = a.remarketing_buyer_id
  LEFT JOIN public.profiles p ON p.id = a.marketplace_user_id
  WHERE a.deal_id = p_deal_id
  ORDER BY a.granted_at DESC;
$$;

-- STEP 9: Update RLS policies for contact-based access
DROP POLICY IF EXISTS "Buyers can view own access" ON public.data_room_access;
CREATE POLICY "Buyers can view own access"
  ON public.data_room_access
  FOR SELECT TO authenticated
  USING (
    marketplace_user_id = auth.uid()
    OR contact_id IN (
      SELECT c.id FROM public.contacts c WHERE c.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contacts_owner_select" ON public.contacts;
CREATE POLICY "contacts_owner_select" ON public.contacts
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- STEP 10: Reverse sync trigger
CREATE OR REPLACE FUNCTION public.sync_listing_contact_to_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.main_contact_name IS DISTINCT FROM OLD.main_contact_name
      OR NEW.main_contact_email IS DISTINCT FROM OLD.main_contact_email
      OR NEW.main_contact_phone IS DISTINCT FROM OLD.main_contact_phone
      OR NEW.main_contact_title IS DISTINCT FROM OLD.main_contact_title)
  THEN
    UPDATE public.contacts
    SET
      first_name = COALESCE(
        NULLIF(TRIM(split_part(NEW.main_contact_name, ' ', 1)), ''),
        NEW.main_contact_name, first_name),
      last_name = CASE
        WHEN position(' ' IN COALESCE(NEW.main_contact_name, '')) > 0
        THEN TRIM(substring(NEW.main_contact_name FROM position(' ' IN NEW.main_contact_name) + 1))
        ELSE last_name END,
      email = COALESCE(NULLIF(TRIM(lower(NEW.main_contact_email)), ''), email),
      phone = COALESCE(NULLIF(TRIM(NEW.main_contact_phone), ''), phone),
      title = COALESCE(NULLIF(TRIM(NEW.main_contact_title), ''), title),
      updated_at = now()
    WHERE listing_id = NEW.id
      AND is_primary_seller_contact = true
      AND contact_type = 'seller';

    IF NOT FOUND AND NEW.main_contact_name IS NOT NULL AND TRIM(NEW.main_contact_name) != '' THEN
      INSERT INTO public.contacts
        (first_name, last_name, email, phone, title,
         contact_type, listing_id, is_primary_seller_contact, source)
      VALUES (
        COALESCE(NULLIF(TRIM(split_part(NEW.main_contact_name, ' ', 1)), ''), NEW.main_contact_name),
        CASE WHEN position(' ' IN NEW.main_contact_name) > 0
             THEN TRIM(substring(NEW.main_contact_name FROM position(' ' IN NEW.main_contact_name) + 1))
             ELSE '' END,
        NULLIF(TRIM(lower(NEW.main_contact_email)), ''),
        NULLIF(TRIM(NEW.main_contact_phone), ''),
        NULLIF(TRIM(NEW.main_contact_title), ''),
        'seller', NEW.id, true, 'listing_sync'
      )
      ON CONFLICT (lower(email), listing_id) WHERE contact_type = 'seller' AND email IS NOT NULL AND archived = false
        DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_listing_to_contacts ON public.listings;
CREATE TRIGGER trg_sync_listing_to_contacts
  AFTER UPDATE ON public.listings
  FOR EACH ROW
  WHEN (
    OLD.main_contact_name IS DISTINCT FROM NEW.main_contact_name
    OR OLD.main_contact_email IS DISTINCT FROM NEW.main_contact_email
    OR OLD.main_contact_phone IS DISTINCT FROM NEW.main_contact_phone
    OR OLD.main_contact_title IS DISTINCT FROM NEW.main_contact_title
  )
  EXECUTE FUNCTION public.sync_listing_contact_to_contacts();