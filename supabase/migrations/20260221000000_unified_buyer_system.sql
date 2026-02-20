-- ============================================================================
-- UNIFIED BUYER SYSTEM: Schema Cleanup + Marketplace Auto-Sync
--
-- Phase 1: Drop 12 overengineered/dead fields from remarketing_buyers
-- Phase 2: Create auto-sync trigger: profiles → remarketing_buyers on approval
--
-- SAFETY: Column drops are reversible via backup. Trigger is additive.
-- ============================================================================


-- ============================================================================
-- PHASE 1: DROP 12 DEAD/OVERENGINEERED COLUMNS
-- ============================================================================
-- A. Overengineered (AI extracts garbage): specialized_focus, strategic_priorities,
--    revenue_sweet_spot, ebitda_sweet_spot, deal_preferences, deal_breakers, key_quotes
-- B. Dead/redundant (zero usage): employee_range, detected_email_pattern,
--    contact_discovery_status, last_contact_discovery_at, scores_stale_since
--
-- NOTE: linkedin_employee_range on deals/pipeline tables is a DIFFERENT field — untouched.

ALTER TABLE public.remarketing_buyers
  DROP COLUMN IF EXISTS specialized_focus,
  DROP COLUMN IF EXISTS strategic_priorities,
  DROP COLUMN IF EXISTS revenue_sweet_spot,
  DROP COLUMN IF EXISTS ebitda_sweet_spot,
  DROP COLUMN IF EXISTS deal_preferences,
  DROP COLUMN IF EXISTS deal_breakers,
  DROP COLUMN IF EXISTS key_quotes,
  DROP COLUMN IF EXISTS employee_range,
  DROP COLUMN IF EXISTS detected_email_pattern,
  DROP COLUMN IF EXISTS contact_discovery_status,
  DROP COLUMN IF EXISTS last_contact_discovery_at,
  DROP COLUMN IF EXISTS scores_stale_since;


-- ============================================================================
-- PHASE 2: AUTO-SYNC MARKETPLACE PROFILES → REMARKETING_BUYERS ON APPROVAL
-- ============================================================================
-- When a marketplace user is approved (profiles.approval_status → 'approved'),
-- auto-create or update a remarketing_buyers record with their signup data.
-- Source priority: 80 (below transcript at 100, above website at 60).
--
-- Field mapping:
--   profiles.company/company_name → remarketing_buyers.company_name
--   profiles.buyer_type → remarketing_buyers.buyer_type
--   profiles.ideal_target_description → remarketing_buyers.thesis_summary
--   profiles.business_categories → remarketing_buyers.target_industries
--   profiles.target_locations → remarketing_buyers.target_geographies
--   profiles.website → remarketing_buyers.company_website
--   profiles.linkedin_profile → remarketing_buyers.buyer_linkedin
--   profiles.target_deal_size_min/max → remarketing_buyers.target_revenue_min/max

CREATE OR REPLACE FUNCTION public.sync_marketplace_buyer_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_name TEXT;
  v_buyer_type TEXT;
  v_thesis TEXT;
  v_industries TEXT[];
  v_geographies TEXT[];
  v_website TEXT;
  v_linkedin TEXT;
  v_rev_min NUMERIC;
  v_rev_max NUMERIC;
  v_email_domain TEXT;
  v_existing_id UUID;
BEGIN
  -- Only fire when approval_status changes to 'approved'
  IF NEW.approval_status = 'approved' AND
     (OLD.approval_status IS DISTINCT FROM 'approved') THEN

    -- Extract company name (try company_name first, then company)
    v_company_name := COALESCE(NULLIF(TRIM(NEW.company_name), ''), NULLIF(TRIM(NEW.company), ''));
    IF v_company_name IS NULL OR v_company_name = '' THEN
      -- Cannot create buyer without a name
      RAISE NOTICE 'Skipping buyer sync for profile % — no company name', NEW.id;
      RETURN NEW;
    END IF;

    -- Map buyer_type
    v_buyer_type := CASE
      WHEN NEW.buyer_type ILIKE '%pe%' OR NEW.buyer_type ILIKE '%private equity%' THEN 'pe_firm'
      WHEN NEW.buyer_type ILIKE '%platform%' THEN 'platform'
      WHEN NEW.buyer_type ILIKE '%strategic%' OR NEW.buyer_type ILIKE '%corporate%' THEN 'strategic'
      WHEN NEW.buyer_type ILIKE '%family%' THEN 'family_office'
      WHEN NEW.buyer_type ILIKE '%search%' THEN 'other'
      WHEN NEW.buyer_type ILIKE '%individual%' THEN 'other'
      ELSE 'other'
    END;

    -- Thesis from ideal_target_description or mandate_blurb
    v_thesis := COALESCE(
      NULLIF(TRIM(NEW.ideal_target_description), ''),
      NULLIF(TRIM(NEW.mandate_blurb), ''),
      NULLIF(TRIM(NEW.bio), '')
    );

    -- Extract industries from business_categories JSON (handle both arrays and scalars)
    IF NEW.business_categories IS NOT NULL AND NEW.business_categories::text != 'null' THEN
      IF jsonb_typeof(NEW.business_categories::jsonb) = 'array' THEN
        SELECT ARRAY(
          SELECT jsonb_array_elements_text(NEW.business_categories::jsonb)
        ) INTO v_industries;
      ELSE
        v_industries := ARRAY[NEW.business_categories::jsonb #>> '{}'];
      END IF;
    END IF;

    -- Extract geographies from target_locations JSON (handle both arrays and scalars)
    IF NEW.target_locations IS NOT NULL AND NEW.target_locations::text != 'null' THEN
      IF jsonb_typeof(NEW.target_locations::jsonb) = 'array' THEN
        SELECT ARRAY(
          SELECT jsonb_array_elements_text(NEW.target_locations::jsonb)
        ) INTO v_geographies;
      ELSE
        v_geographies := ARRAY[NEW.target_locations::jsonb #>> '{}'];
      END IF;
    END IF;

    -- Website and LinkedIn
    v_website := NULLIF(TRIM(NEW.website), '');
    v_linkedin := NULLIF(TRIM(NEW.linkedin_profile), '');

    -- Revenue range from deal size fields
    v_rev_min := NEW.target_deal_size_min;
    v_rev_max := NEW.target_deal_size_max;

    -- Extract email domain
    IF NEW.email IS NOT NULL AND NEW.email LIKE '%@%' THEN
      v_email_domain := lower(split_part(NEW.email, '@', 2));
    END IF;

    -- Check for existing buyer by website domain or company name
    IF v_website IS NOT NULL THEN
      SELECT id INTO v_existing_id
      FROM public.remarketing_buyers
      WHERE archived = false
        AND company_website IS NOT NULL
        AND extract_domain(company_website) = extract_domain(v_website)
      LIMIT 1;
    END IF;

    IF v_existing_id IS NULL THEN
      -- Try matching by company name (case-insensitive)
      SELECT id INTO v_existing_id
      FROM public.remarketing_buyers
      WHERE archived = false
        AND lower(trim(company_name)) = lower(trim(v_company_name))
      LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
      -- UPDATE existing buyer — only fill empty fields (priority 80 < transcript 100)
      UPDATE public.remarketing_buyers
      SET
        buyer_type = COALESCE(buyer_type, v_buyer_type),
        thesis_summary = COALESCE(thesis_summary, v_thesis),
        target_industries = CASE WHEN target_industries IS NULL OR array_length(target_industries, 1) IS NULL
                            THEN v_industries ELSE target_industries END,
        target_geographies = CASE WHEN target_geographies IS NULL OR array_length(target_geographies, 1) IS NULL
                             THEN v_geographies ELSE target_geographies END,
        company_website = COALESCE(company_website, v_website),
        buyer_linkedin = COALESCE(buyer_linkedin, v_linkedin),
        target_revenue_min = COALESCE(target_revenue_min, v_rev_min),
        target_revenue_max = COALESCE(target_revenue_max, v_rev_max),
        email_domain = COALESCE(email_domain, v_email_domain),
        extraction_sources = COALESCE(extraction_sources, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'type', 'marketplace_profile',
          'profile_id', NEW.id,
          'priority', 80,
          'extracted_at', now()::text,
          'fields_extracted', jsonb_build_array(
            'buyer_type', 'thesis_summary', 'target_industries',
            'target_geographies', 'company_website', 'buyer_linkedin'
          )
        )),
        data_last_updated = now(),
        updated_at = now()
      WHERE id = v_existing_id;

      RAISE NOTICE 'Updated existing remarketing_buyer % from marketplace profile %', v_existing_id, NEW.id;
    ELSE
      -- INSERT new buyer
      INSERT INTO public.remarketing_buyers (
        company_name,
        buyer_type,
        thesis_summary,
        target_industries,
        target_geographies,
        company_website,
        buyer_linkedin,
        target_revenue_min,
        target_revenue_max,
        email_domain,
        data_completeness,
        extraction_sources,
        data_last_updated
      ) VALUES (
        v_company_name,
        v_buyer_type,
        v_thesis,
        v_industries,
        v_geographies,
        v_website,
        v_linkedin,
        v_rev_min,
        v_rev_max,
        v_email_domain,
        'low',
        jsonb_build_array(jsonb_build_object(
          'type', 'marketplace_profile',
          'profile_id', NEW.id,
          'priority', 80,
          'extracted_at', now()::text,
          'fields_extracted', jsonb_build_array(
            'company_name', 'buyer_type', 'thesis_summary', 'target_industries',
            'target_geographies', 'company_website', 'buyer_linkedin'
          )
        )),
        now()
      );

      RAISE NOTICE 'Created new remarketing_buyer from marketplace profile %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_marketplace_buyer_on_approval ON public.profiles;
CREATE TRIGGER trg_sync_marketplace_buyer_on_approval
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_marketplace_buyer_on_approval();


-- ============================================================================
-- PHASE 3: RETROACTIVE BACKFILL
-- ============================================================================
-- Create remarketing_buyers for already-approved marketplace users who don't
-- have a corresponding record yet.

INSERT INTO public.remarketing_buyers (
  company_name,
  buyer_type,
  thesis_summary,
  target_industries,
  target_geographies,
  company_website,
  buyer_linkedin,
  target_revenue_min,
  target_revenue_max,
  email_domain,
  data_completeness,
  extraction_sources,
  data_last_updated
)
SELECT
  COALESCE(NULLIF(TRIM(p.company_name), ''), NULLIF(TRIM(p.company), '')) AS company_name,
  CASE
    WHEN p.buyer_type ILIKE '%pe%' OR p.buyer_type ILIKE '%private equity%' THEN 'pe_firm'
    WHEN p.buyer_type ILIKE '%platform%' THEN 'platform'
    WHEN p.buyer_type ILIKE '%strategic%' OR p.buyer_type ILIKE '%corporate%' THEN 'strategic'
    WHEN p.buyer_type ILIKE '%family%' THEN 'family_office'
    ELSE 'other'
  END AS buyer_type,
  COALESCE(NULLIF(TRIM(p.ideal_target_description), ''), NULLIF(TRIM(p.mandate_blurb), '')) AS thesis_summary,
  CASE WHEN p.business_categories IS NOT NULL AND p.business_categories::text != 'null'
         AND jsonb_typeof(p.business_categories::jsonb) = 'array'
    THEN (SELECT ARRAY(SELECT jsonb_array_elements_text(p.business_categories::jsonb)))
    WHEN p.business_categories IS NOT NULL AND p.business_categories::text != 'null'
         AND jsonb_typeof(p.business_categories::jsonb) = 'string'
    THEN ARRAY[p.business_categories::jsonb #>> '{}']
    ELSE NULL
  END AS target_industries,
  CASE WHEN p.target_locations IS NOT NULL AND p.target_locations::text != 'null'
         AND jsonb_typeof(p.target_locations::jsonb) = 'array'
    THEN (SELECT ARRAY(SELECT jsonb_array_elements_text(p.target_locations::jsonb)))
    WHEN p.target_locations IS NOT NULL AND p.target_locations::text != 'null'
         AND jsonb_typeof(p.target_locations::jsonb) = 'string'
    THEN ARRAY[p.target_locations::jsonb #>> '{}']
    ELSE NULL
  END AS target_geographies,
  NULLIF(TRIM(p.website), '') AS company_website,
  NULLIF(TRIM(p.linkedin_profile), '') AS buyer_linkedin,
  p.target_deal_size_min,
  p.target_deal_size_max,
  CASE WHEN p.email LIKE '%@%' THEN lower(split_part(p.email, '@', 2)) ELSE NULL END AS email_domain,
  'low' AS data_completeness,
  jsonb_build_array(jsonb_build_object(
    'type', 'marketplace_backfill',
    'profile_id', p.id,
    'priority', 80,
    'extracted_at', now()::text
  ))::jsonb AS extraction_sources,
  now() AS data_last_updated
FROM public.profiles p
WHERE p.approval_status = 'approved'
  AND COALESCE(NULLIF(TRIM(p.company_name), ''), NULLIF(TRIM(p.company), '')) IS NOT NULL
  -- Skip if a buyer with the same website or company name already exists
  AND NOT EXISTS (
    SELECT 1 FROM public.remarketing_buyers rb
    WHERE rb.archived = false
      AND (
        (rb.company_website IS NOT NULL AND p.website IS NOT NULL
         AND extract_domain(rb.company_website) = extract_domain(p.website))
        OR lower(trim(rb.company_name)) = lower(trim(COALESCE(NULLIF(TRIM(p.company_name), ''), NULLIF(TRIM(p.company), ''))))
      )
  )
ON CONFLICT DO NOTHING;
