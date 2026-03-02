-- ============================================================================
-- MIGRATION: Drop duplicate contact/address columns from deal_pipeline
-- ============================================================================
-- Run AFTER 20260506100000_migrate_deal_contact_fields.sql has been
-- verified in production.
--
-- These columns are redundant because:
--   - Buyer contact info lives on connection_requests (lead_*) or contacts
--     (via buyer_contact_id FK)
--   - Company address lives on listings (via listing_id FK)
--   - company_address on deal_pipeline was never written to
--
-- The get_deals_with_buyer_profiles() RPC already sources contact_name etc.
-- from connection_requests.lead_*, so the frontend continues to work.
-- ============================================================================

BEGIN;

-- ─── Step 1: Drop the columns ───────────────────────────────────────────

ALTER TABLE public.deal_pipeline
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS contact_company,
  DROP COLUMN IF EXISTS contact_phone,
  DROP COLUMN IF EXISTS contact_role,
  DROP COLUMN IF EXISTS contact_title,
  DROP COLUMN IF EXISTS company_address;


-- ─── Step 2: Rewrite trigger functions that referenced these columns ────

-- create_deal_from_connection_request: remove contact_* from INSERT
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
  SELECT id INTO default_stage_id
  FROM public.deal_stages
  WHERE is_default = TRUE
  ORDER BY position
  LIMIT 1;

  SELECT title INTO listing_title
  FROM public.listings
  WHERE id = NEW.listing_id;

  deal_title := COALESCE(NEW.lead_name, 'Unknown') || ' - ' || COALESCE(listing_title, 'Unknown Listing');

  IF NEW.user_id IS NOT NULL THEN
    SELECT c.id, c.remarketing_buyer_id
    INTO v_buyer_contact_id, v_remarketing_buyer_id
    FROM public.contacts c
    WHERE c.profile_id = NEW.user_id
      AND c.contact_type = 'buyer'
      AND c.archived = false
    LIMIT 1;
  END IF;

  IF NEW.listing_id IS NOT NULL THEN
    SELECT c.id INTO v_seller_contact_id
    FROM public.contacts c
    WHERE c.listing_id = NEW.listing_id
      AND c.contact_type = 'seller'
      AND c.is_primary_seller_contact = true
      AND c.archived = false
    LIMIT 1;
  END IF;

  INSERT INTO public.deal_pipeline (
    listing_id,
    stage_id,
    connection_request_id,
    title,
    description,
    source,
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


-- create_deal_from_inbound_lead: remove contact_* from INSERT
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
  IF OLD.status != 'converted' AND NEW.status = 'converted' THEN
    SELECT id INTO default_stage_id
    FROM public.deal_stages
    WHERE is_default = TRUE
    ORDER BY position
    LIMIT 1;

    SELECT title INTO listing_title
    FROM public.listings
    WHERE id = NEW.mapped_to_listing_id;

    deal_title := COALESCE(NEW.name, 'Unknown') || ' - ' || COALESCE(listing_title, 'Unknown Listing');

    IF NEW.email IS NOT NULL THEN
      SELECT c.id, c.remarketing_buyer_id
      INTO v_buyer_contact_id, v_remarketing_buyer_id
      FROM public.contacts c
      WHERE lower(c.email) = lower(NEW.email)
        AND c.contact_type = 'buyer'
        AND c.archived = false
      LIMIT 1;
    END IF;

    IF NEW.mapped_to_listing_id IS NOT NULL THEN
      SELECT c.id INTO v_seller_contact_id
      FROM public.contacts c
      WHERE c.listing_id = NEW.mapped_to_listing_id
        AND c.contact_type = 'seller'
        AND c.is_primary_seller_contact = true
        AND c.archived = false
      LIMIT 1;
    END IF;

    INSERT INTO public.deal_pipeline (
      listing_id,
      stage_id,
      inbound_lead_id,
      title,
      description,
      source,
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


-- auto_create_deal_from_connection_request: remove contact_* from INSERT
CREATE OR REPLACE FUNCTION public.auto_create_deal_from_connection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_inquiry_stage_id uuid;
  deal_source_value text;
  contact_name_value text;
  buyer_priority_value integer;
BEGIN
  SELECT id INTO new_inquiry_stage_id
  FROM public.deal_stages
  WHERE name = 'New Inquiry'
  LIMIT 1;

  deal_source_value := CASE
    WHEN NEW.source IN ('website', 'marketplace', 'webflow', 'manual') THEN NEW.source
    ELSE 'marketplace'
  END;

  IF NEW.user_id IS NOT NULL THEN
    SELECT
      COALESCE(p.first_name || ' ' || p.last_name, p.email),
      COALESCE(calculate_buyer_priority_score(p.buyer_type), 0)
    INTO
      contact_name_value,
      buyer_priority_value
    FROM public.profiles p
    WHERE p.id = NEW.user_id;
  ELSE
    contact_name_value := NEW.lead_name;
    buyer_priority_value := COALESCE(NEW.buyer_priority_score, 0);
  END IF;

  INSERT INTO public.deal_pipeline (
    listing_id,
    stage_id,
    connection_request_id,
    value,
    probability,
    source,
    title,
    buyer_priority_score,
    nda_status,
    fee_agreement_status,
    created_at,
    stage_entered_at
  ) VALUES (
    NEW.listing_id,
    new_inquiry_stage_id,
    NEW.id,
    0,
    5,
    deal_source_value,
    COALESCE(
      contact_name_value || ' - ' || (SELECT title FROM public.listings WHERE id = NEW.listing_id),
      'New Deal'
    ),
    buyer_priority_value,
    CASE
      WHEN NEW.lead_nda_signed THEN 'signed'
      WHEN NEW.lead_nda_email_sent THEN 'sent'
      ELSE 'not_sent'
    END,
    CASE
      WHEN NEW.lead_fee_agreement_signed THEN 'signed'
      WHEN NEW.lead_fee_agreement_email_sent THEN 'sent'
      ELSE 'not_sent'
    END,
    NEW.created_at,
    NEW.created_at
  );

  RETURN NEW;
END;
$function$;


-- create_deal_on_request_approval: remove contact_* from INSERT
CREATE OR REPLACE FUNCTION public.create_deal_on_request_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_deal_id uuid;
  qualified_stage_id uuid;
  nda_status text := 'not_sent';
  fee_status text := 'not_sent';
  src text;
  deal_title text;
  new_deal_id uuid;
  v_listing_website text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND COALESCE(OLD.status,'') <> 'approved' THEN
    SELECT id INTO existing_deal_id FROM public.deal_pipeline WHERE connection_request_id = NEW.id LIMIT 1;
    IF existing_deal_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT website INTO v_listing_website
    FROM public.listings
    WHERE id = NEW.listing_id;

    IF NOT public.is_valid_company_website(v_listing_website) THEN
      RETURN NEW;
    END IF;

    SELECT id INTO qualified_stage_id FROM public.deal_stages
      WHERE is_active = true AND name = 'Qualified'
      ORDER BY position
      LIMIT 1;

    IF qualified_stage_id IS NULL THEN
      SELECT id INTO qualified_stage_id FROM public.deal_stages WHERE is_active = true ORDER BY position LIMIT 1;
    END IF;

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

    SELECT COALESCE(l.title, 'Unknown') INTO deal_title FROM public.listings l WHERE l.id = NEW.listing_id;

    INSERT INTO public.deal_pipeline (
      listing_id, stage_id, connection_request_id, value, probability, expected_close_date,
      assigned_to, stage_entered_at, source,
      nda_status, fee_agreement_status, title, description, priority
    )
    VALUES (
      NEW.listing_id, qualified_stage_id, NEW.id, 0, 50, NULL,
      NEW.approved_by, now(), src,
      nda_status, fee_status,
      deal_title,
      COALESCE(NEW.user_message, 'Deal created from approved connection request'),
      'medium'
    )
    RETURNING id INTO new_deal_id;

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


-- ─── Step 3: Rewrite RPCs that returned contact_* from deal columns ─────

-- get_deals_with_details: remove d.contact_* (already has buyer_contact from contacts JOIN)
DROP FUNCTION IF EXISTS public.get_deals_with_details();

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
  stage_id UUID,
  stage_name TEXT,
  stage_color TEXT,
  stage_position INTEGER,
  listing_id UUID,
  listing_title TEXT,
  listing_revenue NUMERIC,
  listing_ebitda NUMERIC,
  listing_location TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_company TEXT,
  contact_phone TEXT,
  contact_role TEXT,
  buyer_contact_id UUID,
  buyer_contact_name TEXT,
  buyer_contact_email TEXT,
  seller_contact_id UUID,
  seller_contact_name TEXT,
  remarketing_buyer_id UUID,
  remarketing_buyer_company TEXT,
  nda_status TEXT,
  fee_agreement_status TEXT,
  followed_up BOOLEAN,
  followed_up_at TIMESTAMP WITH TIME ZONE,
  assigned_to UUID,
  assigned_admin_name TEXT,
  assigned_admin_email TEXT,
  total_tasks INTEGER,
  pending_tasks INTEGER,
  completed_tasks INTEGER,
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
    ds.id as stage_id,
    ds.name as stage_name,
    ds.color as stage_color,
    ds.position as stage_position,
    l.id as listing_id,
    l.title as listing_title,
    l.revenue as listing_revenue,
    l.ebitda as listing_ebitda,
    l.location as listing_location,
    -- Contact info now from connection_requests or contacts table
    COALESCE(
      TRIM(bc.first_name || ' ' || bc.last_name),
      cr.lead_name
    ) as contact_name,
    COALESCE(bc.email, cr.lead_email) as contact_email,
    COALESCE(rb.company_name, cr.lead_company) as contact_company,
    COALESCE(bc.phone, cr.lead_phone) as contact_phone,
    COALESCE(bc.title, cr.lead_role) as contact_role,
    d.buyer_contact_id,
    CASE WHEN bc.id IS NOT NULL
      THEN TRIM(bc.first_name || ' ' || bc.last_name)
      ELSE NULL
    END as buyer_contact_name,
    bc.email as buyer_contact_email,
    d.seller_contact_id,
    CASE WHEN sc.id IS NOT NULL
      THEN TRIM(sc.first_name || ' ' || sc.last_name)
      ELSE NULL
    END as seller_contact_name,
    d.remarketing_buyer_id,
    rb.company_name as remarketing_buyer_company,
    d.nda_status,
    d.fee_agreement_status,
    d.followed_up,
    d.followed_up_at,
    d.assigned_to,
    COALESCE(p.first_name || ' ' || p.last_name, p.email) as assigned_admin_name,
    p.email as assigned_admin_email,
    COALESCE(task_stats.total_tasks, 0) as total_tasks,
    COALESCE(task_stats.pending_tasks, 0) as pending_tasks,
    COALESCE(task_stats.completed_tasks, 0) as completed_tasks,
    COALESCE(activity_stats.activity_count, 0) as activity_count
  FROM public.deal_pipeline d
  LEFT JOIN public.deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN public.listings l ON d.listing_id = l.id
  LEFT JOIN public.profiles p ON d.assigned_to = p.id
  LEFT JOIN public.contacts bc ON d.buyer_contact_id = bc.id
  LEFT JOIN public.contacts sc ON d.seller_contact_id = sc.id
  LEFT JOIN public.remarketing_buyers rb ON d.remarketing_buyer_id = rb.id
  LEFT JOIN public.connection_requests cr ON cr.id = d.connection_request_id
  LEFT JOIN (
    SELECT
      entity_id AS deal_id,
      COUNT(*)::integer as total_tasks,
      SUM(CASE WHEN status IN ('pending', 'pending_approval', 'in_progress', 'overdue') THEN 1 ELSE 0 END)::integer as pending_tasks,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::integer as completed_tasks
    FROM public.daily_standup_tasks
    WHERE entity_type = 'deal'
    GROUP BY entity_id
  ) task_stats ON d.id = task_stats.deal_id
  LEFT JOIN (
    SELECT
      deal_id,
      COUNT(*)::integer as activity_count
    FROM public.deal_activities
    GROUP BY deal_id
  ) activity_stats ON d.id = activity_stats.deal_id
  WHERE d.deleted_at IS NULL
  ORDER BY d.updated_at DESC;
$$;

COMMIT;
