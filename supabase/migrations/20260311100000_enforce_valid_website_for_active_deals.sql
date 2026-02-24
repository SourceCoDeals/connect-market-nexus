-- ============================================================================
-- ENFORCE VALID COMPANY WEBSITE FOR ACTIVE DEALS
--
-- Problem: Old marketplace deals and GP Partner imports have placeholder/fake
-- websites (e.g. unknown-*.placeholder, *.unknown) or no website at all.
-- These should not be in active deals.
--
-- This migration:
--   1. Creates a helper function is_valid_company_website()
--   2. Archives listings in "All Deals" without valid websites
--   3. Soft-deletes pipeline deals whose listings lack valid websites
--   4. Adds website validation to move_deal_stage_with_ownership RPC
--   5. Adds website validation to create_deal_on_request_approval trigger
--
-- SAFETY:
--   - Listings are archived (remarketing_status = 'archived'), not deleted
--   - Deals are soft-deleted (deleted_at = now()), fully reversible
--   - Marketplace listing status is NOT changed
--   - All operations are idempotent
-- ============================================================================


-- ─── 1. Helper function: is_valid_company_website ───────────────────────────

CREATE OR REPLACE FUNCTION public.is_valid_company_website(website TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    website IS NOT NULL
    AND TRIM(website) <> ''
    AND website NOT LIKE 'unknown-%.placeholder'
    AND website NOT LIKE '%.unknown'
    AND LOWER(TRIM(website)) NOT IN ('n/a', 'none', 'unknown', 'na', 'null', '-')
$$;

COMMENT ON FUNCTION public.is_valid_company_website(TEXT) IS
  'Returns TRUE if the website is a real company domain, not a placeholder or empty value. '
  'Used to enforce that only deals with verified company websites can be in active deals.';


-- ─── 2. Archive listings in "All Deals" without valid websites ──────────────
-- These are listings that appear in the remarketing "All Deals" view.
-- We set remarketing_status = 'archived' so they no longer show up.
-- The marketplace status is NOT changed.

UPDATE public.listings
SET remarketing_status = 'archived'
WHERE remarketing_status = 'active'
  AND deleted_at IS NULL
  AND NOT public.is_valid_company_website(website);


-- ─── 3. Soft-delete pipeline deals whose listings lack valid websites ───────
-- These are deal records in the pipeline (deals table) where the associated
-- listing has no valid website.

UPDATE public.deals
SET deleted_at = now()
WHERE deleted_at IS NULL
  AND listing_id IN (
    SELECT id FROM public.listings
    WHERE NOT public.is_valid_company_website(website)
  );


-- ─── 4. Update move_deal_stage_with_ownership RPC ───────────────────────────
-- Add website validation: block moves to active stages if listing lacks website.

CREATE OR REPLACE FUNCTION public.move_deal_stage_with_ownership(
  p_deal_id uuid,
  p_new_stage_id uuid,
  p_current_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deal_record RECORD;
  v_new_stage_record RECORD;
  v_old_stage_name text;
  v_new_stage_name text;
  v_should_assign_owner boolean := false;
  v_different_owner boolean := false;
  v_previous_owner_id uuid;
  v_previous_owner_name text;
  v_current_admin_name text;
  v_listing_website text;
  v_result jsonb;
BEGIN
  -- Get current deal info
  SELECT * INTO v_deal_record FROM deals WHERE id = p_deal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;

  -- Get old and new stage names
  SELECT name INTO v_old_stage_name FROM deal_stages WHERE id = v_deal_record.stage_id;
  SELECT * INTO v_new_stage_record FROM deal_stages WHERE id = p_new_stage_id;
  v_new_stage_name := v_new_stage_record.name;

  -- ── Website validation: block active stage moves without valid website ──
  IF v_new_stage_record.stage_type = 'active' THEN
    SELECT website INTO v_listing_website
    FROM listings
    WHERE id = v_deal_record.listing_id;

    IF NOT public.is_valid_company_website(v_listing_website) THEN
      RAISE EXCEPTION 'Cannot move deal to active stage: the company listing does not have a valid website/domain. Please add a real company website before moving this deal.';
    END IF;
  END IF;

  -- Check if we should auto-assign owner
  -- Condition: Moving FROM "New Inquiry" AND assigned_to is NULL
  IF v_old_stage_name = 'New Inquiry' AND v_deal_record.assigned_to IS NULL THEN
    v_should_assign_owner := true;
  END IF;

  -- Check if different admin is modifying an assigned deal
  IF v_deal_record.assigned_to IS NOT NULL
     AND v_deal_record.assigned_to != p_current_admin_id THEN
    v_different_owner := true;
    v_previous_owner_id := v_deal_record.assigned_to;

    -- Get previous owner name
    SELECT first_name || ' ' || last_name INTO v_previous_owner_name
    FROM profiles
    WHERE id = v_previous_owner_id;

    -- Get current admin name
    SELECT first_name || ' ' || last_name INTO v_current_admin_name
    FROM profiles
    WHERE id = p_current_admin_id;
  END IF;

  -- Update deal stage
  UPDATE deals
  SET
    stage_id = p_new_stage_id,
    stage_entered_at = now(),
    updated_at = now(),
    -- Auto-assign owner if conditions met
    assigned_to = CASE
      WHEN v_should_assign_owner THEN p_current_admin_id
      ELSE assigned_to
    END,
    owner_assigned_at = CASE
      WHEN v_should_assign_owner THEN now()
      ELSE owner_assigned_at
    END,
    owner_assigned_by = CASE
      WHEN v_should_assign_owner THEN p_current_admin_id
      ELSE owner_assigned_by
    END
  WHERE id = p_deal_id;

  -- Log activity for stage change (using valid 'stage_change' type)
  INSERT INTO deal_activities (
    deal_id,
    admin_id,
    activity_type,
    title,
    description,
    metadata
  ) VALUES (
    p_deal_id,
    p_current_admin_id,
    'stage_change',
    'Stage Changed: ' || v_old_stage_name || ' → ' || v_new_stage_name,
    CASE
      WHEN v_should_assign_owner THEN
        'Deal moved to ' || v_new_stage_name || '. Owner auto-assigned.'
      WHEN v_different_owner THEN
        'Deal moved by ' || COALESCE(v_current_admin_name, 'admin') || ' (different from owner: ' || COALESCE(v_previous_owner_name, 'unknown') || ')'
      ELSE
        'Deal moved to ' || v_new_stage_name
    END,
    jsonb_build_object(
      'old_stage', v_old_stage_name,
      'new_stage', v_new_stage_name,
      'owner_assigned', v_should_assign_owner,
      'different_owner', v_different_owner,
      'previous_owner_id', v_previous_owner_id,
      'current_admin_id', p_current_admin_id
    )
  );

  -- Create in-app notification for previous owner if different admin modified
  IF v_different_owner THEN
    INSERT INTO admin_notifications (
      admin_id,
      deal_id,
      notification_type,
      title,
      message,
      action_url,
      metadata
    ) VALUES (
      v_previous_owner_id,
      p_deal_id,
      'deal_modified',
      'Your deal was modified',
      COALESCE(v_current_admin_name, 'Another admin') || ' moved your deal from "' || v_old_stage_name || '" to "' || v_new_stage_name || '"',
      '/admin/pipeline?deal=' || p_deal_id,
      jsonb_build_object(
        'modifying_admin_id', p_current_admin_id,
        'modifying_admin_name', v_current_admin_name,
        'old_stage', v_old_stage_name,
        'new_stage', v_new_stage_name
      )
    );
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'deal_id', p_deal_id,
    'old_stage_name', v_old_stage_name,
    'new_stage_name', v_new_stage_name,
    'owner_assigned', v_should_assign_owner,
    'different_owner_warning', v_different_owner,
    'previous_owner_id', v_previous_owner_id,
    'previous_owner_name', v_previous_owner_name,
    'assigned_to', CASE WHEN v_should_assign_owner THEN p_current_admin_id ELSE v_deal_record.assigned_to END
  );

  RETURN v_result;
END;
$$;


-- ─── 5. Update create_deal_on_request_approval trigger ──────────────────────
-- Add website validation: skip deal creation if listing lacks valid website.
-- The connection request is still approved, but no deal is created.

CREATE OR REPLACE FUNCTION public.create_deal_on_request_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_deal_id uuid;
  qualified_stage_id uuid;
  buyer_name text;
  buyer_email text;
  buyer_company text;
  buyer_phone text;
  buyer_role text;
  nda_status text := 'not_sent';
  fee_status text := 'not_sent';
  src text;
  deal_title text;
  new_deal_id uuid;
  v_listing_website text;
BEGIN
  -- Only proceed when status transitions to approved
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND COALESCE(OLD.status,'') <> 'approved' THEN
    -- Avoid duplicates
    SELECT id INTO existing_deal_id FROM public.deals WHERE connection_request_id = NEW.id LIMIT 1;
    IF existing_deal_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    -- ── Website validation: skip deal creation if listing lacks valid website ──
    SELECT website INTO v_listing_website
    FROM public.listings
    WHERE id = NEW.listing_id;

    IF NOT public.is_valid_company_website(v_listing_website) THEN
      -- Still approve the connection request, but don't create a deal
      -- The admin will need to add a valid website to the listing first
      RETURN NEW;
    END IF;

    -- Find qualified stage id
    SELECT id INTO qualified_stage_id FROM public.deal_stages
      WHERE is_active = true AND name = 'Qualified'
      ORDER BY position
      LIMIT 1;

    -- Fallback to first active stage
    IF qualified_stage_id IS NULL THEN
      SELECT id INTO qualified_stage_id FROM public.deal_stages WHERE is_active = true ORDER BY position LIMIT 1;
    END IF;

    -- Determine contact info
    SELECT COALESCE(NEW.lead_name, p.first_name || ' ' || p.last_name),
           COALESCE(NEW.lead_email, p.email),
           COALESCE(NEW.lead_company, p.company),
           COALESCE(NEW.lead_phone, p.phone_number),
           COALESCE(NEW.lead_role, p.job_title)
    INTO buyer_name, buyer_email, buyer_company, buyer_phone, buyer_role
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

    -- NDA/Fee statuses
    IF COALESCE(NEW.lead_nda_signed, false) THEN
      nda_status := 'signed';
    ELSIF COALESCE(NEW.lead_nda_email_sent, false) THEN
      nda_status := 'sent';
    END IF;

    IF COALESCE(NEW.lead_fee_agreement_signed, false) THEN
      fee_status := 'signed';
    ELSIF COALESCE(NEW.lead_fee_agreement_email_sent, false) THEN
      fee_status := 'sent';
    END IF;

    src := COALESCE(NEW.source, 'marketplace');

    -- Deal title from listing
    SELECT COALESCE(l.title, 'Unknown') INTO deal_title FROM public.listings l WHERE l.id = NEW.listing_id;

    -- Insert deal
    INSERT INTO public.deals (
      listing_id, stage_id, connection_request_id, value, probability, expected_close_date,
      assigned_to, stage_entered_at, source,
      contact_name, contact_email, contact_company, contact_phone, contact_role,
      nda_status, fee_agreement_status, title, description, priority
    )
    VALUES (
      NEW.listing_id, qualified_stage_id, NEW.id, 0, 50, NULL,
      NEW.approved_by, now(), src,
      buyer_name, buyer_email, buyer_company, buyer_phone, buyer_role,
      nda_status, fee_status,
      deal_title,
      COALESCE(NEW.user_message, 'Deal created from approved connection request'),
      'medium'
    )
    RETURNING id INTO new_deal_id;

    -- Insert an activity note with the initial user message
    IF new_deal_id IS NOT NULL THEN
      INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
      VALUES (
        new_deal_id,
        NEW.approved_by,
        'note_added',
        'Created from connection request',
        COALESCE(NEW.user_message, 'Approved connection request and created deal'),
        jsonb_build_object('connection_request_id', NEW.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- Summary:
--   1. Created is_valid_company_website() helper function
--   2. Archived ~N listings without valid websites from "All Deals"
--   3. Soft-deleted ~N deals in pipeline without valid websites
--   4. Updated move_deal_stage_with_ownership to block stage moves without website
--   5. Updated create_deal_on_request_approval to skip deal creation without website
-- ============================================================================
