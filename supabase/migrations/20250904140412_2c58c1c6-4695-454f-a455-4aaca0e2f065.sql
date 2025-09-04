-- Create improved get_deals_with_details RPC function
CREATE OR REPLACE FUNCTION public.get_deals_with_details()
RETURNS TABLE(
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
  followup_overdue boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    
    -- Contact information
    d.contact_name,
    d.contact_email,
    d.contact_company,
    d.contact_phone,
    d.contact_role,
    
    -- Administrative status
    d.nda_status,
    d.fee_agreement_status,
    d.followed_up,
    d.followed_up_at,
    
    -- Assignment information
    d.assigned_to,
    CASE 
      WHEN assigned_admin.id IS NOT NULL 
      THEN COALESCE(assigned_admin.first_name || ' ' || assigned_admin.last_name, assigned_admin.email)
      ELSE NULL 
    END as assigned_admin_name,
    assigned_admin.email as assigned_admin_email,
    
    -- Real task counts
    COALESCE(task_counts.total_tasks, 0) as total_tasks,
    COALESCE(task_counts.pending_tasks, 0) as pending_tasks,
    COALESCE(task_counts.completed_tasks, 0) as completed_tasks,
    
    -- Activity count
    COALESCE(activity_counts.activity_count, 0) as activity_count,
    
    -- Buyer information (from connection requests and profiles)
    buyer_profile.id as buyer_id,
    CASE 
      WHEN buyer_profile.id IS NOT NULL 
      THEN COALESCE(buyer_profile.first_name || ' ' || buyer_profile.last_name, buyer_profile.email)
      ELSE d.contact_name 
    END as buyer_name,
    COALESCE(buyer_profile.email, d.contact_email) as buyer_email,
    COALESCE(buyer_profile.company, d.contact_company) as buyer_company,
    buyer_profile.buyer_type,
    public.calculate_buyer_priority_score(buyer_profile.buyer_type) as buyer_priority_score,
    
    -- Contact tracking
    latest_contact.created_at as last_contact_at,
    latest_contact.contact_type as last_contact_type,
    NULL::timestamp with time zone as next_followup_due,
    false as followup_overdue
    
  FROM deals d
  LEFT JOIN deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN listings l ON d.listing_id = l.id
  LEFT JOIN profiles assigned_admin ON d.assigned_to = assigned_admin.id
  
  -- Get buyer profile via connection request
  LEFT JOIN connection_requests cr ON (
    d.connection_request_id = cr.id 
    OR (d.contact_email IS NOT NULL AND cr.lead_email = d.contact_email)
  )
  LEFT JOIN profiles buyer_profile ON cr.user_id = buyer_profile.id
  
  -- Real task counts
  LEFT JOIN (
    SELECT 
      deal_id,
      COUNT(*) as total_tasks,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks
    FROM deal_tasks
    GROUP BY deal_id
  ) task_counts ON d.id = task_counts.deal_id
  
  -- Activity counts
  LEFT JOIN (
    SELECT 
      deal_id,
      COUNT(*) as activity_count
    FROM deal_activities
    GROUP BY deal_id
  ) activity_counts ON d.id = activity_counts.deal_id
  
  -- Latest contact
  LEFT JOIN (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      created_at,
      contact_type
    FROM deal_contacts
    ORDER BY deal_id, created_at DESC
  ) latest_contact ON d.id = latest_contact.deal_id
  
  ORDER BY d.created_at DESC;
END;
$$;