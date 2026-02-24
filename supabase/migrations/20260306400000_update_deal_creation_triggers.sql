-- ============================================================================
-- MIGRATION: Update deal creation triggers to populate new FK columns
-- ============================================================================
-- Updates the auto-create triggers for deals to set buyer_contact_id and
-- seller_contact_id when a deal is created from a connection_request or
-- inbound_lead.
--
-- Also updates get_deals_with_details RPC to return the new FK columns
-- and join to contacts for enriched buyer/seller info.
--
-- SAFETY:
--   - REPLACEMENT ONLY: Overwrites existing trigger functions.
--   - NO DATA LOSS: Same logic + new column population.
--   - ZERO DOWNTIME: CREATE OR REPLACE is atomic.
-- ============================================================================


-- ─── STEP 1: Update deal-from-connection-request trigger ─────────────────────

CREATE OR REPLACE FUNCTION public.create_deal_from_connection_request()
RETURNS TRIGGER AS $$
DECLARE
  default_stage_id UUID;
  deal_title TEXT;
  listing_title TEXT;
  v_buyer_contact_id UUID;
  v_seller_contact_id UUID;
  v_remarketing_buyer_id UUID;
BEGIN
  -- Get default stage
  SELECT id INTO default_stage_id
  FROM public.deal_stages
  WHERE is_default = TRUE
  ORDER BY position
  LIMIT 1;

  -- Get listing title
  SELECT title INTO listing_title
  FROM public.listings
  WHERE id = NEW.listing_id;

  -- Create deal title
  deal_title := COALESCE(NEW.lead_name, 'Unknown') || ' - ' || COALESCE(listing_title, 'Unknown Listing');

  -- Resolve buyer contact from the requesting user's profile
  IF NEW.user_id IS NOT NULL THEN
    SELECT c.id, c.remarketing_buyer_id
    INTO v_buyer_contact_id, v_remarketing_buyer_id
    FROM public.contacts c
    WHERE c.profile_id = NEW.user_id
      AND c.contact_type = 'buyer'
      AND c.archived = false
    LIMIT 1;
  END IF;

  -- Resolve seller contact (primary seller for this listing)
  IF NEW.listing_id IS NOT NULL THEN
    SELECT c.id INTO v_seller_contact_id
    FROM public.contacts c
    WHERE c.listing_id = NEW.listing_id
      AND c.contact_type = 'seller'
      AND c.is_primary_seller_contact = true
      AND c.archived = false
    LIMIT 1;
  END IF;

  -- Create deal for new connection requests
  INSERT INTO public.deals (
    listing_id,
    stage_id,
    connection_request_id,
    title,
    description,
    source,
    contact_name,
    contact_email,
    contact_company,
    contact_phone,
    contact_role,
    buyer_contact_id,
    seller_contact_id,
    remarketing_buyer_id,
    metadata
  ) VALUES (
    NEW.listing_id,
    default_stage_id,
    NEW.id,
    deal_title,
    NEW.user_message,
    COALESCE(NEW.source, 'marketplace'),
    COALESCE(NEW.lead_name, (SELECT first_name || ' ' || last_name FROM public.profiles WHERE id = NEW.user_id)),
    COALESCE(NEW.lead_email, (SELECT email FROM public.profiles WHERE id = NEW.user_id)),
    NEW.lead_company,
    NEW.lead_phone,
    NEW.lead_role,
    v_buyer_contact_id,
    v_seller_contact_id,
    v_remarketing_buyer_id,
    jsonb_build_object(
      'auto_created', TRUE,
      'source_type', 'connection_request'
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── STEP 2: Update deal-from-inbound-lead trigger ──────────────────────────

CREATE OR REPLACE FUNCTION public.create_deal_from_inbound_lead()
RETURNS TRIGGER AS $$
DECLARE
  default_stage_id UUID;
  deal_title TEXT;
  listing_title TEXT;
  v_buyer_contact_id UUID;
  v_seller_contact_id UUID;
  v_remarketing_buyer_id UUID;
BEGIN
  -- Only create deal when lead is converted
  IF OLD.status != 'converted' AND NEW.status = 'converted' THEN
    -- Get default stage
    SELECT id INTO default_stage_id
    FROM public.deal_stages
    WHERE is_default = TRUE
    ORDER BY position
    LIMIT 1;

    -- Get listing title
    SELECT title INTO listing_title
    FROM public.listings
    WHERE id = NEW.mapped_to_listing_id;

    -- Create deal title
    deal_title := COALESCE(NEW.name, 'Unknown') || ' - ' || COALESCE(listing_title, 'Unknown Listing');

    -- Try to resolve buyer contact by email
    IF NEW.email IS NOT NULL THEN
      SELECT c.id, c.remarketing_buyer_id
      INTO v_buyer_contact_id, v_remarketing_buyer_id
      FROM public.contacts c
      WHERE lower(c.email) = lower(NEW.email)
        AND c.contact_type = 'buyer'
        AND c.archived = false
      LIMIT 1;
    END IF;

    -- Resolve seller contact (primary seller for this listing)
    IF NEW.mapped_to_listing_id IS NOT NULL THEN
      SELECT c.id INTO v_seller_contact_id
      FROM public.contacts c
      WHERE c.listing_id = NEW.mapped_to_listing_id
        AND c.contact_type = 'seller'
        AND c.is_primary_seller_contact = true
        AND c.archived = false
      LIMIT 1;
    END IF;

    -- Create deal for converted lead
    INSERT INTO public.deals (
      listing_id,
      stage_id,
      inbound_lead_id,
      title,
      description,
      source,
      contact_name,
      contact_email,
      contact_company,
      contact_phone,
      contact_role,
      buyer_contact_id,
      seller_contact_id,
      remarketing_buyer_id,
      metadata
    ) VALUES (
      NEW.mapped_to_listing_id,
      default_stage_id,
      NEW.id,
      deal_title,
      NEW.message,
      COALESCE(NEW.source, 'webflow'),
      NEW.name,
      NEW.email,
      NEW.company_name,
      NEW.phone_number,
      NEW.role,
      v_buyer_contact_id,
      v_seller_contact_id,
      v_remarketing_buyer_id,
      jsonb_build_object(
        'auto_created', TRUE,
        'source_type', 'inbound_lead'
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── STEP 3: Update get_deals_with_details to include new FK columns ─────────

CREATE OR REPLACE FUNCTION public.get_deals_with_details()
RETURNS TABLE(
  deal_id UUID,
  deal_title TEXT,
  deal_description TEXT,
  deal_value NUMERIC,
  deal_priority TEXT,
  deal_probability INTEGER,
  deal_expected_close_date DATE,
  deal_source TEXT,
  deal_created_at TIMESTAMP WITH TIME ZONE,
  deal_updated_at TIMESTAMP WITH TIME ZONE,
  deal_stage_entered_at TIMESTAMP WITH TIME ZONE,

  -- Stage information
  stage_id UUID,
  stage_name TEXT,
  stage_color TEXT,
  stage_position INTEGER,

  -- Listing information
  listing_id UUID,
  listing_title TEXT,
  listing_revenue NUMERIC,
  listing_ebitda NUMERIC,
  listing_location TEXT,

  -- Contact information (legacy flat fields)
  contact_name TEXT,
  contact_email TEXT,
  contact_company TEXT,
  contact_phone TEXT,
  contact_role TEXT,

  -- New: buyer contact FK
  buyer_contact_id UUID,
  buyer_contact_name TEXT,
  buyer_contact_email TEXT,

  -- New: seller contact FK
  seller_contact_id UUID,
  seller_contact_name TEXT,

  -- New: remarketing buyer org
  remarketing_buyer_id UUID,
  remarketing_buyer_company TEXT,

  -- Status information
  nda_status TEXT,
  fee_agreement_status TEXT,
  followed_up BOOLEAN,
  followed_up_at TIMESTAMP WITH TIME ZONE,

  -- Assignment information
  assigned_to UUID,
  assigned_admin_name TEXT,
  assigned_admin_email TEXT,

  -- Task counts
  total_tasks INTEGER,
  pending_tasks INTEGER,
  completed_tasks INTEGER,

  -- Activity count
  activity_count INTEGER
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id as deal_id,
    d.title as deal_title,
    d.description as deal_description,
    d.value as deal_value,
    d.priority as deal_priority,
    d.probability as deal_probability,
    d.expected_close_date as deal_expected_close_date,
    d.source as deal_source,
    d.created_at as deal_created_at,
    d.updated_at as deal_updated_at,
    d.stage_entered_at as deal_stage_entered_at,

    -- Stage information
    ds.id as stage_id,
    ds.name as stage_name,
    ds.color as stage_color,
    ds.position as stage_position,

    -- Listing information
    l.id as listing_id,
    l.title as listing_title,
    l.revenue as listing_revenue,
    l.ebitda as listing_ebitda,
    l.location as listing_location,

    -- Contact information (legacy flat fields)
    d.contact_name,
    d.contact_email,
    d.contact_company,
    d.contact_phone,
    d.contact_role,

    -- Buyer contact (from contacts table)
    d.buyer_contact_id,
    CASE WHEN bc.id IS NOT NULL
      THEN TRIM(bc.first_name || ' ' || bc.last_name)
      ELSE NULL
    END as buyer_contact_name,
    bc.email as buyer_contact_email,

    -- Seller contact (from contacts table)
    d.seller_contact_id,
    CASE WHEN sc.id IS NOT NULL
      THEN TRIM(sc.first_name || ' ' || sc.last_name)
      ELSE NULL
    END as seller_contact_name,

    -- Remarketing buyer org
    d.remarketing_buyer_id,
    rb.company_name as remarketing_buyer_company,

    -- Status information
    d.nda_status,
    d.fee_agreement_status,
    d.followed_up,
    d.followed_up_at,

    -- Assignment information
    d.assigned_to,
    COALESCE(p.first_name || ' ' || p.last_name, p.email) as assigned_admin_name,
    p.email as assigned_admin_email,

    -- Task counts
    COALESCE(task_stats.total_tasks, 0) as total_tasks,
    COALESCE(task_stats.pending_tasks, 0) as pending_tasks,
    COALESCE(task_stats.completed_tasks, 0) as completed_tasks,

    -- Activity count
    COALESCE(activity_stats.activity_count, 0) as activity_count

  FROM public.deals d
  LEFT JOIN public.deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN public.listings l ON d.listing_id = l.id
  LEFT JOIN public.profiles p ON d.assigned_to = p.id
  LEFT JOIN public.contacts bc ON d.buyer_contact_id = bc.id
  LEFT JOIN public.contacts sc ON d.seller_contact_id = sc.id
  LEFT JOIN public.remarketing_buyers rb ON d.remarketing_buyer_id = rb.id
  LEFT JOIN (
    SELECT
      deal_id,
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status IN ('pending', 'in_progress') THEN 1 ELSE 0 END) as pending_tasks,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
    FROM public.deal_tasks
    GROUP BY deal_id
  ) task_stats ON d.id = task_stats.deal_id
  LEFT JOIN (
    SELECT
      deal_id,
      COUNT(*) as activity_count
    FROM public.deal_activities
    GROUP BY deal_id
  ) activity_stats ON d.id = activity_stats.deal_id
  WHERE d.deleted_at IS NULL
  ORDER BY d.updated_at DESC;
$$;


-- ============================================================================
-- Summary:
--   2 updated trigger functions: create_deal_from_connection_request,
--     create_deal_from_inbound_lead — now populate buyer_contact_id,
--     seller_contact_id, and remarketing_buyer_id on deal creation.
--   1 updated RPC: get_deals_with_details — now returns buyer_contact_id,
--     seller_contact_id, remarketing_buyer_id with resolved names.
-- ============================================================================
