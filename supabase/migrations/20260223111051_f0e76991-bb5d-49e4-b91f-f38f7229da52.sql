-- Migration 2: sync_marketplace_buyer_on_approval Trigger
CREATE OR REPLACE FUNCTION sync_marketplace_buyer_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  IF NEW.approval_status = 'approved' AND
     (OLD.approval_status IS DISTINCT FROM 'approved') THEN

    v_company_name := COALESCE(NULLIF(TRIM(NEW.company_name), ''), NULLIF(TRIM(NEW.company), ''));
    IF v_company_name IS NULL OR v_company_name = '' THEN
      RAISE NOTICE 'Skipping buyer sync for profile % — no company name', NEW.id;
      RETURN NEW;
    END IF;

    v_buyer_type := CASE
      WHEN NEW.buyer_type ILIKE '%pe%' OR NEW.buyer_type ILIKE '%private equity%' THEN 'pe_firm'
      WHEN NEW.buyer_type ILIKE '%platform%' THEN 'platform'
      WHEN NEW.buyer_type ILIKE '%strategic%' OR NEW.buyer_type ILIKE '%corporate%' THEN 'strategic'
      WHEN NEW.buyer_type ILIKE '%family%' THEN 'family_office'
      WHEN NEW.buyer_type ILIKE '%search%' THEN 'other'
      WHEN NEW.buyer_type ILIKE '%individual%' THEN 'other'
      ELSE 'other'
    END;

    v_thesis := COALESCE(
      NULLIF(TRIM(NEW.ideal_target_description), ''),
      NULLIF(TRIM(NEW.mandate_blurb), ''),
      NULLIF(TRIM(NEW.bio), '')
    );

    IF NEW.business_categories IS NOT NULL AND NEW.business_categories::text != 'null' THEN
      IF jsonb_typeof(NEW.business_categories::jsonb) = 'array' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.business_categories::jsonb)) INTO v_industries;
      ELSE
        v_industries := ARRAY[NEW.business_categories::jsonb #>> '{}'];
      END IF;
    END IF;

    IF NEW.target_locations IS NOT NULL AND NEW.target_locations::text != 'null' THEN
      IF jsonb_typeof(NEW.target_locations::jsonb) = 'array' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.target_locations::jsonb)) INTO v_geographies;
      ELSE
        v_geographies := ARRAY[NEW.target_locations::jsonb #>> '{}'];
      END IF;
    END IF;

    v_website := NULLIF(TRIM(NEW.website), '');
    v_linkedin := NULLIF(TRIM(NEW.linkedin_profile), '');
    v_rev_min := NEW.target_deal_size_min;
    v_rev_max := NEW.target_deal_size_max;

    IF NEW.email IS NOT NULL AND NEW.email LIKE '%@%' THEN
      v_email_domain := lower(split_part(NEW.email, '@', 2));
    END IF;

    IF v_website IS NOT NULL THEN
      SELECT id INTO v_existing_id
      FROM public.remarketing_buyers
      WHERE archived = false
        AND company_website IS NOT NULL
        AND extract_domain(company_website) = extract_domain(v_website)
      LIMIT 1;
    END IF;

    IF v_existing_id IS NULL THEN
      SELECT id INTO v_existing_id
      FROM public.remarketing_buyers
      WHERE archived = false
        AND lower(trim(company_name)) = lower(trim(v_company_name))
      LIMIT 1;
    END IF;

    IF v_existing_id IS NULL AND v_email_domain IS NOT NULL THEN
      SELECT id INTO v_existing_id
      FROM public.remarketing_buyers
      WHERE archived = false
        AND email_domain IS NOT NULL
        AND normalize_domain(email_domain) = normalize_domain(v_email_domain)
        AND COALESCE(universe_id, '00000000-0000-0000-0000-000000000000'::uuid) = '00000000-0000-0000-0000-000000000000'::uuid
      LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
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
      BEGIN
        INSERT INTO public.remarketing_buyers (
          company_name, buyer_type, thesis_summary, target_industries,
          target_geographies, company_website, buyer_linkedin,
          target_revenue_min, target_revenue_max, email_domain,
          data_completeness, extraction_sources, data_last_updated
        ) VALUES (
          v_company_name, v_buyer_type, v_thesis, v_industries,
          v_geographies, v_website, v_linkedin,
          v_rev_min, v_rev_max, v_email_domain,
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
      EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Skipping buyer insert for profile % — duplicate email domain %', NEW.id, v_email_domain;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_marketplace_buyer_on_approval ON public.profiles;
CREATE TRIGGER trg_sync_marketplace_buyer_on_approval
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_marketplace_buyer_on_approval();