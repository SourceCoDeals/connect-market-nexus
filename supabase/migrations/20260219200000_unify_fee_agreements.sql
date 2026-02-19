-- ============================================================================
-- FEE AGREEMENT UNIFICATION: Marketplace ↔ Remarketing Bridge
--
-- This migration:
--   1. Adds marketplace_firm_id FK to remarketing_buyers (the bridge)
--   2. Adds fee_agreement_source to track where the status came from
--   3. Auto-links existing remarketing buyers to marketplace firms by domain
--   4. Populates has_fee_agreement from linked firm_agreements
--   5. Creates a trigger to propagate marketplace changes to remarketing
--
-- SAFETY: All changes are additive (new columns, new trigger). No existing
-- columns are dropped or renamed. Fully reversible by dropping new columns.
-- ============================================================================


-- 1. Add bridge column + source tracking to remarketing_buyers
ALTER TABLE public.remarketing_buyers
  ADD COLUMN IF NOT EXISTS marketplace_firm_id UUID REFERENCES public.firm_agreements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_agreement_source TEXT CHECK (
    fee_agreement_source IS NULL OR
    fee_agreement_source IN ('pe_firm_inherited', 'platform_direct', 'manual_override', 'marketplace_synced')
  );

-- Index for efficient lookups from firm_agreements → remarketing_buyers
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_marketplace_firm_id
  ON public.remarketing_buyers(marketplace_firm_id)
  WHERE marketplace_firm_id IS NOT NULL;


-- 2. Auto-link remarketing buyers to marketplace firms by domain matching
-- Uses the existing extract_domain() function to normalize URLs before comparison
-- Priority: pe_firm_website first (for platforms backed by PE), then company_website

-- Match by pe_firm_website → firm_agreements.website_domain
UPDATE public.remarketing_buyers rb
SET marketplace_firm_id = fa.id
FROM public.firm_agreements fa
WHERE rb.marketplace_firm_id IS NULL
  AND rb.pe_firm_website IS NOT NULL
  AND fa.website_domain IS NOT NULL
  AND extract_domain(rb.pe_firm_website) = fa.website_domain;

-- Match by company_website → firm_agreements.website_domain (for PE firm buyers)
UPDATE public.remarketing_buyers rb
SET marketplace_firm_id = fa.id
FROM public.firm_agreements fa
WHERE rb.marketplace_firm_id IS NULL
  AND rb.company_website IS NOT NULL
  AND fa.website_domain IS NOT NULL
  AND extract_domain(rb.company_website) = fa.website_domain;

-- Match by email_domain as fallback
UPDATE public.remarketing_buyers rb
SET marketplace_firm_id = fa.id
FROM public.firm_agreements fa
WHERE rb.marketplace_firm_id IS NULL
  AND rb.email_domain IS NOT NULL
  AND fa.email_domain IS NOT NULL
  AND rb.email_domain = fa.email_domain;


-- 3. Populate has_fee_agreement from linked marketplace firms
-- Only SET to true if the linked firm has fee_agreement_signed = true
-- Never overwrite an existing manual true with false (preserve manual overrides)
UPDATE public.remarketing_buyers rb
SET
  has_fee_agreement = true,
  fee_agreement_source = 'marketplace_synced'
FROM public.firm_agreements fa
WHERE rb.marketplace_firm_id = fa.id
  AND fa.fee_agreement_signed = true
  AND (rb.has_fee_agreement IS NULL OR rb.has_fee_agreement = false);

-- Also propagate PE firm inheritance: if a remarketing buyer's PE firm has a
-- signed fee agreement, mark the platform as covered too
UPDATE public.remarketing_buyers platform_buyer
SET
  has_fee_agreement = true,
  fee_agreement_source = 'pe_firm_inherited'
FROM public.remarketing_buyers pe_buyer
INNER JOIN public.firm_agreements fa ON pe_buyer.marketplace_firm_id = fa.id
WHERE platform_buyer.pe_firm_website IS NOT NULL
  AND pe_buyer.buyer_type = 'pe_firm'
  AND extract_domain(platform_buyer.pe_firm_website) = extract_domain(pe_buyer.company_website)
  AND fa.fee_agreement_signed = true
  AND (platform_buyer.has_fee_agreement IS NULL OR platform_buyer.has_fee_agreement = false)
  AND platform_buyer.id != pe_buyer.id;


-- 4. Create trigger function: when firm_agreements.fee_agreement_signed changes,
-- propagate to all linked remarketing_buyers
CREATE OR REPLACE FUNCTION public.sync_fee_agreement_to_remarketing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only act when fee_agreement_signed actually changes
  IF OLD.fee_agreement_signed IS DISTINCT FROM NEW.fee_agreement_signed THEN
    IF NEW.fee_agreement_signed = true THEN
      -- Firm signed: mark all linked remarketing buyers as having fee agreement
      UPDATE public.remarketing_buyers
      SET
        has_fee_agreement = true,
        fee_agreement_source = 'marketplace_synced'
      WHERE marketplace_firm_id = NEW.id
        AND (has_fee_agreement IS NULL OR has_fee_agreement = false);

      -- Also propagate to platforms whose PE firm matches this firm's domain
      UPDATE public.remarketing_buyers
      SET
        has_fee_agreement = true,
        fee_agreement_source = 'pe_firm_inherited'
      WHERE pe_firm_website IS NOT NULL
        AND NEW.website_domain IS NOT NULL
        AND extract_domain(pe_firm_website) = NEW.website_domain
        AND (has_fee_agreement IS NULL OR has_fee_agreement = false);

    ELSE
      -- Firm unsigned: only remove marketplace_synced and pe_firm_inherited flags
      -- NEVER remove manual_override — those were set by an admin deliberately
      UPDATE public.remarketing_buyers
      SET
        has_fee_agreement = false,
        fee_agreement_source = NULL
      WHERE marketplace_firm_id = NEW.id
        AND fee_agreement_source IN ('marketplace_synced', 'pe_firm_inherited');

      -- Also remove inheritance from platforms
      UPDATE public.remarketing_buyers
      SET
        has_fee_agreement = false,
        fee_agreement_source = NULL
      WHERE pe_firm_website IS NOT NULL
        AND NEW.website_domain IS NOT NULL
        AND extract_domain(pe_firm_website) = NEW.website_domain
        AND fee_agreement_source = 'pe_firm_inherited';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on firm_agreements
DROP TRIGGER IF EXISTS trg_sync_fee_agreement_to_remarketing ON public.firm_agreements;
CREATE TRIGGER trg_sync_fee_agreement_to_remarketing
  AFTER UPDATE ON public.firm_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fee_agreement_to_remarketing();
