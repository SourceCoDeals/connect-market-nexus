
-- Fix Contact: Unknown issue for marketplace deals
-- Problem: Trigger function doesn't pull contact data from profiles when user_id exists
-- Solution: Update trigger to check profiles table first, then fall back to lead_* fields

-- Drop and recreate the trigger function with proper profile lookup
DROP TRIGGER IF EXISTS trigger_auto_create_deal_from_request ON public.connection_requests;
DROP FUNCTION IF EXISTS public.auto_create_deal_from_connection_request();

CREATE OR REPLACE FUNCTION public.auto_create_deal_from_connection_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_inquiry_stage_id uuid;
  deal_source_value text;
  contact_name_value text;
  contact_email_value text;
  contact_company_value text;
  contact_phone_value text;
  buyer_priority_value integer;
BEGIN
  -- Get New Inquiry stage ID
  SELECT id INTO new_inquiry_stage_id
  FROM public.deal_stages
  WHERE name = 'New Inquiry'
  LIMIT 1;

  -- Map source correctly (website -> webflow)
  deal_source_value := CASE 
    WHEN NEW.source = 'website' THEN 'webflow'
    WHEN NEW.source IN ('marketplace', 'webflow', 'manual') THEN NEW.source
    ELSE 'marketplace'
  END;

  -- Get contact data from profiles if user_id exists, otherwise use lead_* fields
  IF NEW.user_id IS NOT NULL THEN
    -- Marketplace user - get data from profiles table
    SELECT 
      COALESCE(p.first_name || ' ' || p.last_name, p.email),
      p.email,
      p.company,
      p.phone_number,
      COALESCE(calculate_buyer_priority_score(p.buyer_type), 0)
    INTO 
      contact_name_value,
      contact_email_value,
      contact_company_value,
      contact_phone_value,
      buyer_priority_value
    FROM public.profiles p
    WHERE p.id = NEW.user_id;
  ELSE
    -- Webflow/inbound lead - use lead_* fields
    contact_name_value := NEW.lead_name;
    contact_email_value := NEW.lead_email;
    contact_company_value := NEW.lead_company;
    contact_phone_value := NEW.lead_phone;
    buyer_priority_value := COALESCE(NEW.buyer_priority_score, 0);
  END IF;

  -- Create deal automatically with proper contact data
  INSERT INTO public.deals (
    listing_id,
    stage_id,
    connection_request_id,
    value,
    probability,
    source,
    title,
    contact_name,
    contact_email,
    contact_company,
    contact_phone,
    contact_role,
    buyer_priority_score,
    nda_status,
    fee_agreement_status,
    created_at,
    stage_entered_at,
    metadata
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
    COALESCE(contact_name_value, 'Unknown Contact'),
    contact_email_value,
    contact_company_value,
    contact_phone_value,
    COALESCE(NEW.lead_role, ''),
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
    NEW.created_at,
    jsonb_build_object(
      'auto_created', true,
      'created_from_connection_request', true,
      'original_source', NEW.source,
      'has_user_profile', NEW.user_id IS NOT NULL
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_create_deal_from_request
  AFTER INSERT ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_deal_from_connection_request();

DROP FUNCTION IF EXISTS public.get_deals_with_details();

CREATE OR REPLACE FUNCTION public.get_deals_with_details()
RETURNS TABLE (
  deal_id uuid,
  deal_title text,
  deal_description text,
  deal_value numeric,
  deal_probability integer,
  deal_expected_close_date date,
  deal_created_at timestamp with time zone,
  deal_updated_at timestamp with time zone,
  deal_stage_entered_at timestamp with time zone,
  deal_followed_up boolean,
  deal_followed_up_at timestamp with time zone,
  deal_followed_up_by uuid,
  deal_negative_followed_up boolean,
  deal_negative_followed_up_at timestamp with time zone,
  deal_negative_followed_up_by uuid,
  deal_metadata jsonb,
  deal_buyer_priority_score integer,
  deal_priority text,
  deal_source text,
  stage_id uuid,
  stage_name text,
  stage_color text,
  stage_position integer,
  listing_id uuid,
  listing_title text,
  listing_category text,
  listing_real_company_name text,
  listing_revenue numeric,
  listing_ebitda numeric,
  listing_location text,
  connection_request_id uuid,
  buyer_id uuid,
  buyer_name text,
  buyer_email text,
  buyer_company text,
  buyer_phone text,
  buyer_type text,
  assigned_to uuid,
  contact_name text,
  contact_email text,
  contact_company text,
  contact_phone text,
  contact_role text,
  nda_status text,
  fee_agreement_status text,
  last_contact_at timestamp with time zone,
  total_activities integer,
  pending_tasks integer,
  total_tasks integer,
  completed_tasks integer,
  last_activity_at timestamp with time zone,
  company_deal_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id as deal_id,
    d.title as deal_title,
    d.description as deal_description,
    d.value as deal_value,
    d.probability as deal_probability,
    d.expected_close_date as deal_expected_close_date,
    d.created_at as deal_created_at,
    d.updated_at as deal_updated_at,
    d.stage_entered_at as deal_stage_entered_at,
    d.followed_up as deal_followed_up,
    d.followed_up_at as deal_followed_up_at,
    d.followed_up_by as deal_followed_up_by,
    d.negative_followed_up as deal_negative_followed_up,
    d.negative_followed_up_at as deal_negative_followed_up_at,
    d.negative_followed_up_by as deal_negative_followed_up_by,
    d.metadata as deal_metadata,
    d.buyer_priority_score as deal_buyer_priority_score,
    d.priority as deal_priority,
    d.source as deal_source,
    ds.id as stage_id,
    ds.name as stage_name,
    ds.color as stage_color,
    ds.position as stage_position,
    d.listing_id,
    l.title as listing_title,
    l.category as listing_category,
    l.internal_company_name as listing_real_company_name,
    l.revenue as listing_revenue,
    l.ebitda as listing_ebitda,
    l.location as listing_location,
    d.connection_request_id,
    p.id as buyer_id,
    COALESCE(p.first_name || ' ' || p.last_name, p.email) as buyer_name,
    p.email as buyer_email,
    p.company as buyer_company,
    p.phone_number as buyer_phone,
    p.buyer_type,
    d.assigned_to,
    CASE 
      WHEN d.contact_name IS NOT NULL AND d.contact_name != '' AND d.contact_name != 'Unknown' AND d.contact_name != 'Unknown Contact' 
        THEN d.contact_name
      WHEN p.first_name IS NOT NULL OR p.last_name IS NOT NULL 
        THEN COALESCE(p.first_name || ' ' || p.last_name, p.email)
      WHEN cr.lead_name IS NOT NULL AND cr.lead_name != ''
        THEN cr.lead_name
      ELSE 'Unknown Contact'
    END as contact_name,
    COALESCE(NULLIF(d.contact_email, ''), p.email, cr.lead_email) as contact_email,
    COALESCE(NULLIF(d.contact_company, ''), p.company, cr.lead_company) as contact_company,
    COALESCE(NULLIF(d.contact_phone, ''), p.phone_number, cr.lead_phone) as contact_phone,
    d.contact_role,
    d.nda_status,
    d.fee_agreement_status,
    (
      SELECT MAX(dc.created_at)
      FROM deal_contacts dc
      WHERE dc.deal_id = d.id
    ) as last_contact_at,
    (
      SELECT COUNT(*)::integer
      FROM deal_activities da
      WHERE da.deal_id = d.id
    ) as total_activities,
    (
      SELECT COUNT(*)::integer
      FROM deal_tasks dt
      WHERE dt.deal_id = d.id AND dt.status = 'pending'
    ) as pending_tasks,
    (
      SELECT COUNT(*)::integer
      FROM deal_tasks dt
      WHERE dt.deal_id = d.id
    ) as total_tasks,
    (
      SELECT COUNT(*)::integer
      FROM deal_tasks dt
      WHERE dt.deal_id = d.id AND dt.status = 'completed'
    ) as completed_tasks,
    GREATEST(
      d.updated_at,
      (SELECT MAX(da.created_at) FROM deal_activities da WHERE da.deal_id = d.id),
      (SELECT MAX(dt.updated_at) FROM deal_tasks dt WHERE dt.deal_id = d.id)
    ) as last_activity_at,
    COUNT(*) OVER (PARTITION BY COALESCE(l.internal_company_name, d.contact_company, p.company)) as company_deal_count
  FROM deals d
  LEFT JOIN deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN listings l ON d.listing_id = l.id
  LEFT JOIN connection_requests cr ON d.connection_request_id = cr.id
  LEFT JOIN profiles p ON cr.user_id = p.id
  WHERE d.deleted_at IS NULL
  ORDER BY d.created_at DESC;
END;
$$;

UPDATE public.deals d
SET 
  contact_name = COALESCE(p.first_name || ' ' || p.last_name, p.email, cr.lead_name, d.contact_name),
  contact_email = COALESCE(p.email, cr.lead_email, d.contact_email),
  contact_company = COALESCE(p.company, cr.lead_company, d.contact_company),
  contact_phone = COALESCE(p.phone_number, cr.lead_phone, d.contact_phone),
  updated_at = NOW()
FROM connection_requests cr
LEFT JOIN profiles p ON cr.user_id = p.id
WHERE d.connection_request_id = cr.id
  AND d.deleted_at IS NULL
  AND (
    d.contact_name IN ('Unknown', 'Unknown Contact', '') 
    OR d.contact_name IS NULL
  );
