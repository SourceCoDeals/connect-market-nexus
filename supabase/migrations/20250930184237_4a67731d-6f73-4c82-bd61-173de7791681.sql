-- Update get_deals_with_details to properly sync document statuses from connection_requests
DROP FUNCTION IF EXISTS public.get_deals_with_details();

CREATE OR REPLACE FUNCTION public.get_deals_with_details()
RETURNS TABLE (
  deal_id uuid,
  deal_title text,
  deal_description text,
  deal_value numeric,
  deal_priority text,
  deal_probability integer,
  deal_expected_close_date date,
  deal_source text,
  deal_created_at timestamp with time zone,
  deal_updated_at timestamp with time zone,
  deal_stage_entered_at timestamp with time zone,
  
  stage_id uuid,
  stage_name text,
  stage_color text,
  stage_position integer,
  
  listing_id uuid,
  listing_title text,
  listing_revenue numeric,
  listing_ebitda numeric,
  listing_location text,
  
  contact_name text,
  contact_email text,
  contact_company text,
  contact_phone text,
  contact_role text,
  
  nda_status text,
  fee_agreement_status text,
  followed_up boolean,
  followed_up_at timestamp with time zone,
  
  assigned_to uuid,
  assigned_admin_name text,
  assigned_admin_email text,
  
  total_tasks bigint,
  pending_tasks bigint,
  completed_tasks bigint,
  
  activity_count bigint,
  
  buyer_id uuid,
  buyer_name text,
  buyer_email text,
  buyer_company text,
  buyer_type text,
  buyer_priority_score integer,
  
  last_contact_at timestamp with time zone,
  last_contact_type text,
  next_followup_due timestamp with time zone,
  followup_overdue boolean,
  
  connection_request_id uuid
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
    
    -- Contact information (prefer connection_request data)
    COALESCE(cr.lead_name, d.contact_name) as contact_name,
    COALESCE(cr.lead_email, d.contact_email) as contact_email,
    COALESCE(cr.lead_company, d.contact_company) as contact_company,
    COALESCE(cr.lead_phone, d.contact_phone) as contact_phone,
    COALESCE(cr.lead_role, d.contact_role) as contact_role,
    
    -- Document statuses from connection_requests (with fallback to deal fields and buyer profile)
    CASE 
      WHEN cr.lead_nda_signed THEN 'signed'
      WHEN cr.lead_nda_email_sent THEN 'sent'
      WHEN buyer.nda_signed THEN 'signed'
      WHEN buyer.nda_email_sent THEN 'sent'
      WHEN d.nda_status IS NOT NULL THEN d.nda_status
      ELSE 'not_sent'
    END as nda_status,
    
    CASE 
      WHEN cr.lead_fee_agreement_signed THEN 'signed'
      WHEN cr.lead_fee_agreement_email_sent THEN 'sent'
      WHEN buyer.fee_agreement_signed THEN 'signed'
      WHEN buyer.fee_agreement_email_sent THEN 'sent'
      WHEN d.fee_agreement_status IS NOT NULL THEN d.fee_agreement_status
      ELSE 'not_sent'
    END as fee_agreement_status,
    
    d.followed_up,
    d.followed_up_at,
    
    -- Assignment information
    d.assigned_to,
    COALESCE(assigned_admin.first_name || ' ' || assigned_admin.last_name, assigned_admin.email) as assigned_admin_name,
    assigned_admin.email as assigned_admin_email,
    
    -- Task counts
    COALESCE(task_counts.total_tasks, 0)::bigint as total_tasks,
    COALESCE(task_counts.pending_tasks, 0)::bigint as pending_tasks,
    COALESCE(task_counts.completed_tasks, 0)::bigint as completed_tasks,
    
    -- Activity count
    COALESCE(activity_counts.activity_count, 0)::bigint as activity_count,
    
    -- Enhanced buyer information
    buyer.id as buyer_id,
    COALESCE(buyer.first_name || ' ' || buyer.last_name, buyer.email) as buyer_name,
    buyer.email as buyer_email,
    buyer.company as buyer_company,
    buyer.buyer_type,
    COALESCE(d.buyer_priority_score, 0) as buyer_priority_score,
    
    -- Contact tracking
    d.updated_at as last_contact_at,
    'deal_updated'::text as last_contact_type,
    NULL::timestamp with time zone as next_followup_due,
    false as followup_overdue,
    
    -- Connection request ID for document management
    d.connection_request_id
    
  FROM deals d
  LEFT JOIN deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN listings l ON d.listing_id = l.id
  LEFT JOIN profiles assigned_admin ON d.assigned_to = assigned_admin.id
  LEFT JOIN connection_requests cr ON d.connection_request_id = cr.id
  LEFT JOIN profiles buyer ON cr.user_id = buyer.id
  
  -- Fixed task counting subquery
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*) as total_tasks,
      COUNT(CASE WHEN dt.status = 'pending' THEN 1 END) as pending_tasks,
      COUNT(CASE WHEN dt.status = 'completed' THEN 1 END) as completed_tasks
    FROM deal_tasks dt
    WHERE dt.deal_id = d.id
  ) task_counts ON true
  
  -- Activity counting subquery  
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as activity_count
    FROM deal_activities da
    WHERE da.deal_id = d.id
  ) activity_counts ON true
  
  ORDER BY d.created_at DESC;
END;
$$;