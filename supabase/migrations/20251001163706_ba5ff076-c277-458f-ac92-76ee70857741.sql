-- Add real company name from listings to deals RPC
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
    d.connection_request_id,
    p.id as buyer_id,
    COALESCE(p.first_name || ' ' || p.last_name, p.email) as buyer_name,
    p.email as buyer_email,
    p.company as buyer_company,
    p.phone_number as buyer_phone,
    p.buyer_type,
    d.assigned_to,
    d.contact_name,
    d.contact_email,
    d.contact_company,
    d.contact_phone,
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
  WHERE d.id IS NOT NULL
  ORDER BY d.created_at DESC;
END;
$$;