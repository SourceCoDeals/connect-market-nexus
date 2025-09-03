-- Fix the ambiguous deal_id reference in get_deals_with_details function
CREATE OR REPLACE FUNCTION get_deals_with_details()
RETURNS TABLE (
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
  nda_status TEXT,
  fee_agreement_status TEXT,
  followed_up BOOLEAN,
  followed_up_at TIMESTAMP WITH TIME ZONE,
  assigned_to UUID,
  assigned_admin_name TEXT,
  assigned_admin_email TEXT,
  total_tasks BIGINT,
  pending_tasks BIGINT,
  completed_tasks BIGINT,
  activity_count BIGINT,
  buyer_id UUID,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_company TEXT,
  buyer_type TEXT,
  buyer_priority_score INTEGER,
  next_followup_due TIMESTAMP WITH TIME ZONE,
  followup_overdue BOOLEAN
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
    -- Calculate probability based on stage position and buyer type
    CASE 
      WHEN ds.position <= 1 THEN 15
      WHEN ds.position <= 2 THEN 30
      WHEN ds.position <= 3 THEN 60
      ELSE 85
    END as deal_probability,
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
    
    -- Contact information (from deal or connection request)
    COALESCE(d.contact_name, cr.lead_name, p.first_name || ' ' || p.last_name) as contact_name,
    COALESCE(d.contact_email, cr.lead_email, p.email) as contact_email,
    COALESCE(d.contact_company, cr.lead_company, p.company) as contact_company,
    COALESCE(d.contact_phone, cr.lead_phone, p.phone_number) as contact_phone,
    COALESCE(d.contact_role, cr.lead_role, p.job_title) as contact_role,
    
    -- Administrative status
    d.nda_status,
    d.fee_agreement_status,
    d.followed_up,
    d.followed_up_at,
    
    -- Assignment information
    d.assigned_to,
    admin_prof.first_name || ' ' || admin_prof.last_name as assigned_admin_name,
    admin_prof.email as assigned_admin_email,
    
    -- Task counts
    COALESCE(task_counts.total_tasks, 0) as total_tasks,
    COALESCE(task_counts.pending_tasks, 0) as pending_tasks,
    COALESCE(task_counts.completed_tasks, 0) as completed_tasks,
    
    -- Activity count
    COALESCE(activity_counts.activity_count, 0) as activity_count,
    
    -- Enhanced buyer information
    COALESCE(p.id, cr.user_id) as buyer_id,
    COALESCE(d.contact_name, cr.lead_name, p.first_name || ' ' || p.last_name) as buyer_name,
    COALESCE(d.contact_email, cr.lead_email, p.email) as buyer_email,
    COALESCE(d.contact_company, cr.lead_company, p.company) as buyer_company,
    -- Map buyer_type to simplified categories
    CASE 
      WHEN LOWER(p.buyer_type) LIKE '%pe%' OR LOWER(p.buyer_type) LIKE '%private equity%' THEN 'privateEquity'
      WHEN LOWER(p.buyer_type) LIKE '%family office%' THEN 'familyOffice'
      WHEN LOWER(p.buyer_type) LIKE '%search fund%' THEN 'searchFund'
      WHEN LOWER(p.buyer_type) LIKE '%corporate%' OR LOWER(p.buyer_type) LIKE '%strategic%' THEN 'corporate'
      WHEN LOWER(p.buyer_type) LIKE '%independent sponsor%' THEN 'independentSponsor'
      WHEN LOWER(p.buyer_type) LIKE '%individual%' THEN 'individual'
      WHEN LOWER(p.buyer_type) LIKE '%advisor%' THEN 'advisor'
      WHEN LOWER(p.buyer_type) LIKE '%business owner%' THEN 'businessOwner'
      ELSE 'individual'
    END as buyer_type,
    -- Calculate buyer priority score
    d.buyer_priority_score,
    
    -- Follow-up tracking
    (d.created_at + INTERVAL '7 days') as next_followup_due,
    CASE 
      WHEN d.followed_up = false AND d.created_at < (NOW() - INTERVAL '7 days') THEN true
      ELSE false
    END as followup_overdue
    
  FROM deals d
  LEFT JOIN deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN listings l ON d.listing_id = l.id
  LEFT JOIN connection_requests cr ON d.connection_request_id = cr.id
  LEFT JOIN profiles p ON cr.user_id = p.id
  LEFT JOIN profiles admin_prof ON d.assigned_to = admin_prof.id
  LEFT JOIN (
    SELECT 
      dt.deal_id,
      COUNT(*) as total_tasks,
      COUNT(CASE WHEN dt.status = 'pending' THEN 1 END) as pending_tasks,
      COUNT(CASE WHEN dt.status = 'completed' THEN 1 END) as completed_tasks
    FROM deal_tasks dt
    GROUP BY dt.deal_id
  ) task_counts ON d.id = task_counts.deal_id
  LEFT JOIN (
    SELECT 
      da.deal_id,
      COUNT(*) as activity_count
    FROM deal_activities da
    GROUP BY da.deal_id
  ) activity_counts ON d.id = activity_counts.deal_id
  WHERE d.id IS NOT NULL
  ORDER BY d.created_at DESC;
END;
$$;