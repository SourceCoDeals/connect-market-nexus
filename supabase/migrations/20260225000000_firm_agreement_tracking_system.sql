-- ============================================================================
-- FIRM-LEVEL AGREEMENT TRACKING SYSTEM
--
-- Implements the NDA & Fee Agreement Tracking System Specification:
--   1. Expanded agreement statuses (not_started → sent → signed, with redline path)
--   2. Domain aliases for firms with multiple/rebranded domains
--   3. Generic email domain blocklist (gmail, yahoo, etc.)
--   4. Agreement scope: blanket (all deals) vs deal-specific
--   5. PE firm → portfolio company inheritance check algorithm
--   6. Manual upload and redline workflow tracking
--   7. Agreement expiration tracking
--
-- SAFETY: All changes are additive — new columns, new tables, new functions.
-- Existing firm_agreements booleans are preserved for backward compatibility.
-- ============================================================================


-- ============================================================================
-- 1. EXPAND AGREEMENT STATUSES ON firm_agreements
-- ============================================================================
-- Currently: nda_signed (boolean), fee_agreement_signed (boolean)
-- New: nda_status / fee_agreement_status TEXT with full lifecycle

ALTER TABLE public.firm_agreements
  ADD COLUMN IF NOT EXISTS nda_status TEXT DEFAULT 'not_started'
    CHECK (nda_status IN ('not_started', 'sent', 'redlined', 'under_review', 'signed', 'expired', 'declined')),
  ADD COLUMN IF NOT EXISTS fee_agreement_status TEXT DEFAULT 'not_started'
    CHECK (fee_agreement_status IN ('not_started', 'sent', 'redlined', 'under_review', 'signed', 'expired', 'declined')),
  -- Scope: blanket covers all deals, deal-specific covers one
  ADD COLUMN IF NOT EXISTS fee_agreement_scope TEXT DEFAULT 'blanket'
    CHECK (fee_agreement_scope IN ('blanket', 'deal_specific')),
  ADD COLUMN IF NOT EXISTS fee_agreement_deal_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  -- Expiration tracking
  ADD COLUMN IF NOT EXISTS nda_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fee_agreement_expires_at TIMESTAMPTZ,
  -- Document storage for manually uploaded agreements
  ADD COLUMN IF NOT EXISTS nda_document_url TEXT,
  ADD COLUMN IF NOT EXISTS fee_agreement_document_url TEXT,
  -- Source tracking (how the agreement was executed)
  ADD COLUMN IF NOT EXISTS nda_source TEXT DEFAULT 'platform'
    CHECK (nda_source IN ('platform', 'manual', 'docusign', 'other')),
  ADD COLUMN IF NOT EXISTS fee_agreement_source TEXT DEFAULT 'platform'
    CHECK (fee_agreement_source IN ('platform', 'manual', 'docusign', 'other')),
  -- Redline tracking
  ADD COLUMN IF NOT EXISTS nda_redline_notes TEXT,
  ADD COLUMN IF NOT EXISTS fee_agreement_redline_notes TEXT,
  ADD COLUMN IF NOT EXISTS nda_redline_document_url TEXT,
  ADD COLUMN IF NOT EXISTS fee_agreement_redline_document_url TEXT,
  -- Custom terms notes
  ADD COLUMN IF NOT EXISTS nda_custom_terms TEXT,
  ADD COLUMN IF NOT EXISTS fee_agreement_custom_terms TEXT,
  -- Coverage inheritance tracking
  ADD COLUMN IF NOT EXISTS nda_inherited_from_firm_id UUID REFERENCES public.firm_agreements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_inherited_from_firm_id UUID REFERENCES public.firm_agreements(id) ON DELETE SET NULL,
  -- Sent tracking
  ADD COLUMN IF NOT EXISTS nda_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fee_agreement_sent_at TIMESTAMPTZ;


-- Backfill nda_status from existing nda_signed boolean
UPDATE public.firm_agreements
SET nda_status = CASE
  WHEN nda_signed = true THEN 'signed'
  WHEN nda_email_sent = true THEN 'sent'
  ELSE 'not_started'
END
WHERE nda_status = 'not_started';

-- Backfill fee_agreement_status from existing fee_agreement_signed boolean
UPDATE public.firm_agreements
SET fee_agreement_status = CASE
  WHEN fee_agreement_signed = true THEN 'signed'
  WHEN fee_agreement_email_sent = true THEN 'sent'
  ELSE 'not_started'
END
WHERE fee_agreement_status = 'not_started';

-- Backfill nda_sent_at from nda_email_sent_at
UPDATE public.firm_agreements
SET nda_sent_at = nda_email_sent_at
WHERE nda_email_sent_at IS NOT NULL AND nda_sent_at IS NULL;

-- Backfill fee_agreement_sent_at from fee_agreement_email_sent_at
UPDATE public.firm_agreements
SET fee_agreement_sent_at = fee_agreement_email_sent_at
WHERE fee_agreement_email_sent_at IS NOT NULL AND fee_agreement_sent_at IS NULL;

-- Index on status columns for filtering
CREATE INDEX IF NOT EXISTS idx_firm_agreements_nda_status ON public.firm_agreements(nda_status);
CREATE INDEX IF NOT EXISTS idx_firm_agreements_fee_status_text ON public.firm_agreements(fee_agreement_status);
CREATE INDEX IF NOT EXISTS idx_firm_agreements_nda_expires ON public.firm_agreements(nda_expires_at) WHERE nda_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_firm_agreements_fee_expires ON public.firm_agreements(fee_agreement_expires_at) WHERE fee_agreement_expires_at IS NOT NULL;


-- ============================================================================
-- 2. DOMAIN ALIASES TABLE
-- ============================================================================
-- Firms that have multiple email domains (e.g., rebranding from oldfirm.com
-- to newfirm.com) need all domains to resolve to the same firm.

CREATE TABLE IF NOT EXISTS public.firm_domain_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firm_agreements(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(domain)
);

CREATE INDEX IF NOT EXISTS idx_firm_domain_aliases_firm_id ON public.firm_domain_aliases(firm_id);
CREATE INDEX IF NOT EXISTS idx_firm_domain_aliases_domain ON public.firm_domain_aliases(domain);

-- Enable RLS
ALTER TABLE public.firm_domain_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage domain aliases"
  ON public.firm_domain_aliases FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view domain aliases"
  ON public.firm_domain_aliases FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.firm_domain_aliases TO authenticated;
GRANT ALL ON public.firm_domain_aliases TO service_role;

-- Backfill aliases from existing firm_agreements domains
INSERT INTO public.firm_domain_aliases (firm_id, domain, is_primary)
SELECT id, email_domain, true
FROM public.firm_agreements
WHERE email_domain IS NOT NULL AND TRIM(email_domain) != ''
ON CONFLICT (domain) DO NOTHING;

-- Also add website_domain as alias if different from email_domain
INSERT INTO public.firm_domain_aliases (firm_id, domain, is_primary)
SELECT id, website_domain, false
FROM public.firm_agreements
WHERE website_domain IS NOT NULL AND TRIM(website_domain) != ''
  AND (email_domain IS NULL OR website_domain != email_domain)
ON CONFLICT (domain) DO NOTHING;


-- ============================================================================
-- 3. GENERIC EMAIL DOMAIN BLOCKLIST
-- ============================================================================
-- Domains in this list are never used for firm-level matching.
-- Users with these domains must sign individually.

CREATE TABLE IF NOT EXISTS public.generic_email_domains (
  domain TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.generic_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read generic domains"
  ON public.generic_email_domains FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage generic domains"
  ON public.generic_email_domains FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT ON public.generic_email_domains TO authenticated;
GRANT ALL ON public.generic_email_domains TO service_role;

-- Seed the blocklist
INSERT INTO public.generic_email_domains (domain) VALUES
  ('gmail.com'),
  ('yahoo.com'),
  ('outlook.com'),
  ('hotmail.com'),
  ('aol.com'),
  ('icloud.com'),
  ('protonmail.com'),
  ('proton.me'),
  ('mail.com'),
  ('zoho.com'),
  ('yandex.com'),
  ('gmx.com'),
  ('gmx.net'),
  ('live.com'),
  ('msn.com'),
  ('me.com'),
  ('mac.com'),
  ('fastmail.com'),
  ('tutanota.com'),
  ('hey.com'),
  ('pm.me')
ON CONFLICT (domain) DO NOTHING;


-- ============================================================================
-- 4. AGREEMENT STATUS UPDATE FUNCTION (EXPANDED)
-- ============================================================================
-- Replaces the boolean-only update with full status lifecycle.
-- Keeps backward compatibility by syncing booleans.

CREATE OR REPLACE FUNCTION public.update_firm_agreement_status(
  p_firm_id UUID,
  p_agreement_type TEXT,   -- 'nda' or 'fee_agreement'
  p_new_status TEXT,       -- one of the valid statuses
  p_signed_by_name TEXT DEFAULT NULL,
  p_signed_by_user_id UUID DEFAULT NULL,
  p_document_url TEXT DEFAULT NULL,
  p_redline_notes TEXT DEFAULT NULL,
  p_redline_document_url TEXT DEFAULT NULL,
  p_custom_terms TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_source TEXT DEFAULT 'platform',
  p_scope TEXT DEFAULT 'blanket',
  p_deal_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_member_record RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Only admins can update agreement status';
  END IF;

  -- Validate status
  IF p_new_status NOT IN ('not_started', 'sent', 'redlined', 'under_review', 'signed', 'expired', 'declined') THEN
    RAISE EXCEPTION 'Invalid agreement status: %', p_new_status;
  END IF;

  IF p_agreement_type = 'nda' THEN
    UPDATE public.firm_agreements
    SET
      nda_status = p_new_status,
      -- Keep boolean in sync for backward compatibility
      nda_signed = (p_new_status = 'signed'),
      nda_signed_at = CASE WHEN p_new_status = 'signed' THEN COALESCE(nda_signed_at, v_now) ELSE nda_signed_at END,
      nda_signed_by = CASE WHEN p_new_status = 'signed' THEN COALESCE(p_signed_by_user_id, v_admin_id) ELSE nda_signed_by END,
      nda_signed_by_name = CASE WHEN p_new_status = 'signed' THEN COALESCE(p_signed_by_name, nda_signed_by_name) ELSE nda_signed_by_name END,
      nda_sent_at = CASE WHEN p_new_status = 'sent' THEN COALESCE(nda_sent_at, v_now) ELSE nda_sent_at END,
      nda_email_sent = CASE WHEN p_new_status IN ('sent', 'signed') THEN true ELSE nda_email_sent END,
      nda_email_sent_at = CASE WHEN p_new_status = 'sent' AND nda_email_sent_at IS NULL THEN v_now ELSE nda_email_sent_at END,
      nda_document_url = COALESCE(p_document_url, nda_document_url),
      nda_redline_notes = CASE WHEN p_new_status = 'redlined' THEN COALESCE(p_redline_notes, nda_redline_notes) ELSE nda_redline_notes END,
      nda_redline_document_url = CASE WHEN p_new_status = 'redlined' THEN COALESCE(p_redline_document_url, nda_redline_document_url) ELSE nda_redline_document_url END,
      nda_custom_terms = COALESCE(p_custom_terms, nda_custom_terms),
      nda_expires_at = COALESCE(p_expires_at, nda_expires_at),
      nda_source = COALESCE(p_source, nda_source),
      updated_at = v_now
    WHERE id = p_firm_id;

    -- Cascade signed status to firm members
    IF p_new_status = 'signed' THEN
      FOR v_member_record IN
        SELECT user_id FROM public.firm_members WHERE firm_id = p_firm_id AND user_id IS NOT NULL
      LOOP
        UPDATE public.profiles
        SET nda_signed = true, nda_signed_at = COALESCE(nda_signed_at, v_now), updated_at = v_now
        WHERE id = v_member_record.user_id;
      END LOOP;
    END IF;

  ELSIF p_agreement_type = 'fee_agreement' THEN
    UPDATE public.firm_agreements
    SET
      fee_agreement_status = p_new_status,
      fee_agreement_signed = (p_new_status = 'signed'),
      fee_agreement_signed_at = CASE WHEN p_new_status = 'signed' THEN COALESCE(fee_agreement_signed_at, v_now) ELSE fee_agreement_signed_at END,
      fee_agreement_signed_by = CASE WHEN p_new_status = 'signed' THEN COALESCE(p_signed_by_user_id, v_admin_id) ELSE fee_agreement_signed_by END,
      fee_agreement_signed_by_name = CASE WHEN p_new_status = 'signed' THEN COALESCE(p_signed_by_name, fee_agreement_signed_by_name) ELSE fee_agreement_signed_by_name END,
      fee_agreement_sent_at = CASE WHEN p_new_status = 'sent' THEN COALESCE(fee_agreement_sent_at, v_now) ELSE fee_agreement_sent_at END,
      fee_agreement_email_sent = CASE WHEN p_new_status IN ('sent', 'signed') THEN true ELSE fee_agreement_email_sent END,
      fee_agreement_email_sent_at = CASE WHEN p_new_status = 'sent' AND fee_agreement_email_sent_at IS NULL THEN v_now ELSE fee_agreement_email_sent_at END,
      fee_agreement_document_url = COALESCE(p_document_url, fee_agreement_document_url),
      fee_agreement_redline_notes = CASE WHEN p_new_status = 'redlined' THEN COALESCE(p_redline_notes, fee_agreement_redline_notes) ELSE fee_agreement_redline_notes END,
      fee_agreement_redline_document_url = CASE WHEN p_new_status = 'redlined' THEN COALESCE(p_redline_document_url, fee_agreement_redline_document_url) ELSE fee_agreement_redline_document_url END,
      fee_agreement_custom_terms = COALESCE(p_custom_terms, fee_agreement_custom_terms),
      fee_agreement_expires_at = COALESCE(p_expires_at, fee_agreement_expires_at),
      fee_agreement_source = COALESCE(p_source, fee_agreement_source),
      fee_agreement_scope = COALESCE(p_scope, fee_agreement_scope),
      fee_agreement_deal_id = CASE WHEN p_scope = 'deal_specific' THEN p_deal_id ELSE fee_agreement_deal_id END,
      updated_at = v_now
    WHERE id = p_firm_id;

    -- Cascade signed status to firm members
    IF p_new_status = 'signed' THEN
      FOR v_member_record IN
        SELECT user_id FROM public.firm_members WHERE firm_id = p_firm_id AND user_id IS NOT NULL
      LOOP
        UPDATE public.profiles
        SET fee_agreement_signed = true, fee_agreement_signed_at = COALESCE(fee_agreement_signed_at, v_now), updated_at = v_now
        WHERE id = v_member_record.user_id;
      END LOOP;
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid agreement_type: %. Must be nda or fee_agreement', p_agreement_type;
  END IF;

  RETURN TRUE;
END;
$$;


-- ============================================================================
-- 5. AGREEMENT CHECK ALGORITHM
-- ============================================================================
-- The core algorithm from the spec: given an email, determine agreement coverage.
-- Returns: coverage status, coverage source, agreement details.
-- Runs in real-time (< 500ms target).

CREATE OR REPLACE FUNCTION public.check_agreement_coverage(
  p_email TEXT,
  p_agreement_type TEXT DEFAULT 'nda'  -- 'nda' or 'fee_agreement'
)
RETURNS TABLE (
  is_covered BOOLEAN,
  coverage_source TEXT,       -- 'direct', 'domain_match', 'pe_parent', 'not_covered'
  firm_id UUID,
  firm_name TEXT,
  agreement_status TEXT,
  signed_by_name TEXT,
  signed_at TIMESTAMPTZ,
  parent_firm_name TEXT,      -- if coverage is via PE parent
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain TEXT;
  v_is_generic BOOLEAN;
  v_firm_id UUID;
  v_parent_buyer_id UUID;
  v_parent_firm_id UUID;
BEGIN
  -- 1. Extract domain from email
  v_domain := lower(split_part(p_email, '@', 2));

  IF v_domain IS NULL OR v_domain = '' THEN
    RETURN QUERY SELECT false, 'not_covered'::TEXT, NULL::UUID, NULL::TEXT,
      'not_started'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- 2. Check generic domain blocklist
  SELECT EXISTS (
    SELECT 1 FROM public.generic_email_domains WHERE generic_email_domains.domain = v_domain
  ) INTO v_is_generic;

  IF v_is_generic THEN
    RETURN QUERY SELECT false, 'not_covered'::TEXT, NULL::UUID, NULL::TEXT,
      'not_started'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- 3. Direct domain lookup (email_domain or domain aliases)
  IF p_agreement_type = 'nda' THEN
    RETURN QUERY
    SELECT
      fa.nda_status = 'signed' AND (fa.nda_expires_at IS NULL OR fa.nda_expires_at > now()),
      'direct'::TEXT,
      fa.id,
      fa.primary_company_name,
      fa.nda_status,
      fa.nda_signed_by_name,
      fa.nda_signed_at,
      NULL::TEXT,
      fa.nda_expires_at
    FROM public.firm_agreements fa
    WHERE fa.email_domain = v_domain
       OR fa.website_domain = v_domain
       OR EXISTS (SELECT 1 FROM public.firm_domain_aliases fda WHERE fda.firm_id = fa.id AND fda.domain = v_domain)
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  ELSE
    RETURN QUERY
    SELECT
      fa.fee_agreement_status = 'signed' AND (fa.fee_agreement_expires_at IS NULL OR fa.fee_agreement_expires_at > now()),
      'direct'::TEXT,
      fa.id,
      fa.primary_company_name,
      fa.fee_agreement_status,
      fa.fee_agreement_signed_by_name,
      fa.fee_agreement_signed_at,
      NULL::TEXT,
      fa.fee_agreement_expires_at
    FROM public.firm_agreements fa
    WHERE fa.email_domain = v_domain
       OR fa.website_domain = v_domain
       OR EXISTS (SELECT 1 FROM public.firm_domain_aliases fda WHERE fda.firm_id = fa.id AND fda.domain = v_domain)
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 4. PE firm parent lookup: check if domain belongs to a portfolio company
  --    whose parent PE firm has a signed agreement
  --    remarketing_buyers has pe_firm_id for parent-child relationships
  SELECT rb.pe_firm_id INTO v_parent_buyer_id
  FROM public.remarketing_buyers rb
  WHERE rb.pe_firm_id IS NOT NULL
    AND rb.archived = false
    AND (rb.email_domain = v_domain OR extract_domain(rb.company_website) = v_domain)
  LIMIT 1;

  IF v_parent_buyer_id IS NOT NULL THEN
    -- Find the parent PE firm's marketplace firm_id
    -- Match parent buyer to firm_agreements by domain
    IF p_agreement_type = 'nda' THEN
      RETURN QUERY
      SELECT
        fa.nda_status = 'signed' AND (fa.nda_expires_at IS NULL OR fa.nda_expires_at > now()),
        'pe_parent'::TEXT,
        fa.id,
        fa.primary_company_name,
        fa.nda_status,
        fa.nda_signed_by_name,
        fa.nda_signed_at,
        parent_rb.company_name,
        fa.nda_expires_at
      FROM public.remarketing_buyers parent_rb
      LEFT JOIN public.firm_agreements fa ON (
        fa.email_domain = parent_rb.email_domain
        OR fa.website_domain = extract_domain(parent_rb.company_website)
      )
      WHERE parent_rb.id = v_parent_buyer_id
        AND fa.id IS NOT NULL
      LIMIT 1;

      IF FOUND THEN RETURN; END IF;
    ELSE
      RETURN QUERY
      SELECT
        fa.fee_agreement_status = 'signed' AND (fa.fee_agreement_expires_at IS NULL OR fa.fee_agreement_expires_at > now()),
        'pe_parent'::TEXT,
        fa.id,
        fa.primary_company_name,
        fa.fee_agreement_status,
        fa.fee_agreement_signed_by_name,
        fa.fee_agreement_signed_at,
        parent_rb.company_name,
        fa.fee_agreement_expires_at
      FROM public.remarketing_buyers parent_rb
      LEFT JOIN public.firm_agreements fa ON (
        fa.email_domain = parent_rb.email_domain
        OR fa.website_domain = extract_domain(parent_rb.company_website)
      )
      WHERE parent_rb.id = v_parent_buyer_id
        AND fa.id IS NOT NULL
      LIMIT 1;

      IF FOUND THEN RETURN; END IF;
    END IF;
  END IF;

  -- 5. No coverage found
  RETURN QUERY SELECT false, 'not_covered'::TEXT, NULL::UUID, NULL::TEXT,
    'not_started'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TEXT, NULL::TIMESTAMPTZ;
  RETURN;
END;
$$;


-- ============================================================================
-- 6. TRIGGER: KEEP nda_status / fee_agreement_status IN SYNC WITH BOOLEANS
-- ============================================================================
-- When old code updates the booleans, auto-update the status column too.

CREATE OR REPLACE FUNCTION public.sync_agreement_status_from_booleans()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync nda_status when nda_signed boolean changes
  IF OLD.nda_signed IS DISTINCT FROM NEW.nda_signed THEN
    IF NEW.nda_signed = true AND NEW.nda_status != 'signed' THEN
      NEW.nda_status := 'signed';
    ELSIF NEW.nda_signed = false AND NEW.nda_status = 'signed' THEN
      NEW.nda_status := 'not_started';
    END IF;
  END IF;

  -- Sync fee_agreement_status when fee_agreement_signed boolean changes
  IF OLD.fee_agreement_signed IS DISTINCT FROM NEW.fee_agreement_signed THEN
    IF NEW.fee_agreement_signed = true AND NEW.fee_agreement_status != 'signed' THEN
      NEW.fee_agreement_status := 'signed';
    ELSIF NEW.fee_agreement_signed = false AND NEW.fee_agreement_status = 'signed' THEN
      NEW.fee_agreement_status := 'not_started';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_agreement_status_from_booleans ON public.firm_agreements;
CREATE TRIGGER trg_sync_agreement_status_from_booleans
  BEFORE UPDATE ON public.firm_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_agreement_status_from_booleans();


-- ============================================================================
-- 7. AGREEMENT AUDIT LOG
-- ============================================================================
-- Track all agreement status changes for compliance.

CREATE TABLE IF NOT EXISTS public.agreement_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firm_agreements(id) ON DELETE CASCADE,
  agreement_type TEXT NOT NULL CHECK (agreement_type IN ('nda', 'fee_agreement')),
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  document_url TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreement_audit_log_firm_id ON public.agreement_audit_log(firm_id);
CREATE INDEX IF NOT EXISTS idx_agreement_audit_log_created ON public.agreement_audit_log(created_at DESC);

ALTER TABLE public.agreement_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage agreement audit log"
  ON public.agreement_audit_log FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT ON public.agreement_audit_log TO authenticated;
GRANT ALL ON public.agreement_audit_log TO service_role;


-- ============================================================================
-- 8. TRIGGER: LOG AGREEMENT STATUS CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_agreement_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log NDA status changes
  IF OLD.nda_status IS DISTINCT FROM NEW.nda_status THEN
    INSERT INTO public.agreement_audit_log (firm_id, agreement_type, old_status, new_status, changed_by, document_url, notes)
    VALUES (NEW.id, 'nda', OLD.nda_status, NEW.nda_status, auth.uid(), NEW.nda_document_url, NEW.nda_redline_notes);
  END IF;

  -- Log fee agreement status changes
  IF OLD.fee_agreement_status IS DISTINCT FROM NEW.fee_agreement_status THEN
    INSERT INTO public.agreement_audit_log (firm_id, agreement_type, old_status, new_status, changed_by, document_url, notes)
    VALUES (NEW.id, 'fee_agreement', OLD.fee_agreement_status, NEW.fee_agreement_status, auth.uid(), NEW.fee_agreement_document_url, NEW.fee_agreement_redline_notes);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_agreement_status_change ON public.firm_agreements;
CREATE TRIGGER trg_log_agreement_status_change
  AFTER UPDATE ON public.firm_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.log_agreement_status_change();


-- ============================================================================
-- 9. BUYER-FACING: get_my_agreement_status()
-- ============================================================================
-- Called by marketplace buyers to check their own firm's agreement status.
-- No admin required — only returns the caller's own coverage.

CREATE OR REPLACE FUNCTION public.get_my_agreement_status()
RETURNS TABLE (
  nda_covered BOOLEAN,
  nda_status TEXT,
  nda_coverage_source TEXT,
  nda_firm_name TEXT,
  nda_parent_firm_name TEXT,
  fee_covered BOOLEAN,
  fee_status TEXT,
  fee_coverage_source TEXT,
  fee_firm_name TEXT,
  fee_parent_firm_name TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
  v_nda RECORD;
  v_fee RECORD;
BEGIN
  -- Get the caller's email
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  IF v_user_email IS NULL THEN
    RETURN QUERY SELECT
      false, 'not_started'::TEXT, 'not_covered'::TEXT, NULL::TEXT, NULL::TEXT,
      false, 'not_started'::TEXT, 'not_covered'::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Check NDA coverage
  SELECT * INTO v_nda FROM public.check_agreement_coverage(v_user_email, 'nda');

  -- Check fee agreement coverage
  SELECT * INTO v_fee FROM public.check_agreement_coverage(v_user_email, 'fee_agreement');

  RETURN QUERY SELECT
    COALESCE(v_nda.is_covered, false),
    COALESCE(v_nda.agreement_status, 'not_started'),
    COALESCE(v_nda.coverage_source, 'not_covered'),
    v_nda.firm_name,
    v_nda.parent_firm_name,
    COALESCE(v_fee.is_covered, false),
    COALESCE(v_fee.agreement_status, 'not_started'),
    COALESCE(v_fee.coverage_source, 'not_covered'),
    v_fee.firm_name,
    v_fee.parent_firm_name;
  RETURN;
END;
$$;


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- New columns on firm_agreements: 20 (all nullable/defaulted, additive)
-- New tables: firm_domain_aliases, generic_email_domains, agreement_audit_log
-- New functions: update_firm_agreement_status(), check_agreement_coverage(),
--                get_my_agreement_status()
-- New triggers: trg_sync_agreement_status_from_booleans,
--               trg_log_agreement_status_change
-- Backfills: nda_status, fee_agreement_status from existing booleans;
--            domain aliases from existing domains; generic domain seed data
-- ============================================================================
