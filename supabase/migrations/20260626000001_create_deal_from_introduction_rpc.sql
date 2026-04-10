-- ============================================================================
-- F-B1: Consolidate createDealFromIntroduction into a single SECURITY DEFINER
-- RPC that runs in one transaction, replacing the 3-step client-side write.
-- ============================================================================
-- Client JS previously did:
--   1. Upsert buyer contact in contacts table
--   2. INSERT into deal_pipeline
--   3. UPDATE buyer_introductions SET introduction_status = 'deal_created'
--
-- Partial failures between steps 2 and 3 left the deal orphaned without
-- advancing the introduction status. This RPC wraps all three in one tx.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_deal_from_introduction(
  p_introduction_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intro            RECORD;
  v_stage_id         uuid;
  v_listing_title    text;
  v_deal_title       text;
  v_buyer_contact_id uuid;
  v_new_deal_id      uuid;
  v_existing_deal_id uuid;
  v_sanitized_email  text;
  v_actor_id         uuid;
  DEFAULT_PROBABILITY CONSTANT integer := 10;
BEGIN
  -- Get current user for audit trail
  v_actor_id := auth.uid();

  -- 1. Fetch the buyer introduction record
  SELECT *
    INTO v_intro
    FROM public.buyer_introductions
   WHERE id = p_introduction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'create_deal_from_introduction: introduction not found: %', p_introduction_id;
  END IF;

  -- Guard: only create from 'fit_and_interested' status
  IF v_intro.introduction_status <> 'fit_and_interested' THEN
    RAISE EXCEPTION 'create_deal_from_introduction: status is "%" not "fit_and_interested"', v_intro.introduction_status;
  END IF;

  -- 2. Deduplicate: if a deal already exists for this introduction, return it
  SELECT id INTO v_existing_deal_id
    FROM public.deal_pipeline
   WHERE buyer_introduction_id = p_introduction_id
   LIMIT 1;

  IF v_existing_deal_id IS NOT NULL THEN
    RETURN v_existing_deal_id;
  END IF;

  -- 3. Resolve or create buyer contact
  IF v_intro.buyer_email IS NOT NULL THEN
    v_sanitized_email := lower(trim(regexp_replace(v_intro.buyer_email, '/+$', '')));

    IF v_sanitized_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      SELECT id INTO v_buyer_contact_id
        FROM public.contacts
       WHERE email = v_sanitized_email
         AND contact_type = 'buyer'
         AND archived = false
       LIMIT 1;

      IF v_buyer_contact_id IS NULL THEN
        INSERT INTO public.contacts (
          email, name, company, phone, contact_type, source, archived
        ) VALUES (
          v_sanitized_email,
          COALESCE(v_intro.buyer_name, ''),
          COALESCE(v_intro.buyer_firm_name, v_intro.company_name, ''),
          v_intro.buyer_phone,
          'buyer',
          'remarketing',
          false
        )
        RETURNING id INTO v_buyer_contact_id;
      END IF;
    END IF;
  END IF;

  -- 4. Look up the default stage (same logic as other funnels)
  SELECT ds.id INTO v_stage_id
    FROM public.deal_stages ds
   WHERE ds.is_active = true AND ds.is_default = true
   LIMIT 1;

  IF v_stage_id IS NULL THEN
    SELECT ds.id INTO v_stage_id
      FROM public.deal_stages ds
     WHERE ds.is_active = true
     ORDER BY ds.position ASC
     LIMIT 1;
  END IF;

  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'create_deal_from_introduction: no active deal_stages found';
  END IF;

  -- 5. Build deal title
  SELECT l.title INTO v_listing_title
    FROM public.listings l
   WHERE l.id = v_intro.listing_id;

  v_deal_title := COALESCE(v_intro.buyer_firm_name, v_intro.buyer_name, 'Unknown')
    || ' — '
    || COALESCE(v_listing_title, v_intro.company_name, 'Unknown Listing');

  -- 6. INSERT the deal (same probability as all other funnels)
  INSERT INTO public.deal_pipeline (
    title, description, stage_id, listing_id, source,
    nda_status, fee_agreement_status,
    buyer_contact_id, remarketing_buyer_id, buyer_introduction_id,
    value, probability, priority
  ) VALUES (
    v_deal_title,
    'Auto-created from remarketing: ' || COALESCE(v_intro.buyer_name, '') || ' at '
      || COALESCE(v_intro.buyer_firm_name, '') || ' marked as Fit & Interested.'
      || CASE WHEN v_intro.buyer_feedback IS NOT NULL THEN E'\n\nBuyer feedback: ' || v_intro.buyer_feedback ELSE '' END
      || CASE WHEN v_intro.next_step IS NOT NULL THEN E'\nNext step: ' || v_intro.next_step ELSE '' END,
    v_stage_id,
    v_intro.listing_id,
    'remarketing',
    'not_sent',
    'not_sent',
    v_buyer_contact_id,
    v_intro.remarketing_buyer_id,
    p_introduction_id,
    COALESCE(v_intro.expected_deal_size_low, 0),
    DEFAULT_PROBABILITY,
    'medium'
  )
  RETURNING id INTO v_new_deal_id;

  -- 7. Log the deal creation activity
  INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
  VALUES (
    v_new_deal_id,
    v_actor_id,
    'deal_created',
    'Opportunity Created from Remarketing',
    'Deal created when ' || COALESCE(v_intro.buyer_name, 'buyer') || ' ('
      || COALESCE(v_intro.buyer_firm_name, 'firm') || ') was marked as Fit & Interested',
    jsonb_build_object(
      'buyer_introduction_id', p_introduction_id,
      'buyer_name', v_intro.buyer_name,
      'buyer_firm', v_intro.buyer_firm_name,
      'source', 'remarketing_fit_interested',
      'funnel', 'buyer_introduction'
    )
  );

  -- 8. Advance introduction status to 'deal_created' in the same transaction
  UPDATE public.buyer_introductions
     SET introduction_status = 'deal_created',
         updated_at = now()
   WHERE id = p_introduction_id;

  -- 9. Log the status change
  INSERT INTO public.introduction_status_log (introduction_id, new_status, changed_by)
  VALUES (p_introduction_id, 'deal_created', v_actor_id);

  RETURN v_new_deal_id;
END;
$$;

COMMENT ON FUNCTION public.create_deal_from_introduction(uuid) IS
  'Phase 5 (F-B1): Creates a deal_pipeline row from a buyer_introduction in a '
  'single transaction. Replaces the 3-step client-side write that had no '
  'atomicity guarantees.';
