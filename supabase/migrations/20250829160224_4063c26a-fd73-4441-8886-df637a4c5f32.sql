-- Create proper deal stages for SourceCo workflow
INSERT INTO public.deal_stages (name, description, position, color, is_active, is_default) 
VALUES 
  ('New Inquiry', 'Initial inquiry from potential buyer', 0, '#94a3b8', true, true),
  ('Initial Review', 'Admin reviewing buyer credentials and qualification', 1, '#f59e0b', true, false),
  ('Qualified', 'Buyer meets criteria and ready to receive deal information', 2, '#3b82f6', true, false),
  ('Information Sent', 'Deal information has been shared with qualified buyer', 3, '#8b5cf6', true, false),
  ('Due Diligence', 'Buyer is conducting due diligence on the opportunity', 4, '#06b6d4', true, false),
  ('LOI Submitted', 'Letter of Intent has been submitted by buyer', 5, '#f97316', true, false),
  ('Under Contract', 'Deal is under contract and progressing to close', 6, '#10b981', true, false),
  ('Closed Won', 'Deal successfully closed', 7, '#22c55e', true, false),
  ('Closed Lost', 'Deal did not proceed to completion', 8, '#ef4444', true, false)
ON CONFLICT (name) DO NOTHING;

-- Create RPC function to get deals with enhanced details for pipeline management
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
  
  -- Stage information
  stage_id uuid,
  stage_name text,
  stage_color text,
  stage_position integer,
  
  -- Listing information
  listing_id uuid,
  listing_title text,
  listing_revenue numeric,
  listing_ebitda numeric,
  listing_location text,
  
  -- Contact information
  contact_name text,
  contact_email text,
  contact_company text,
  contact_phone text,
  contact_role text,
  
  -- Administrative status information
  nda_status text,
  fee_agreement_status text,
  followed_up boolean,
  followed_up_at timestamp with time zone,
  
  -- Assignment information
  assigned_to uuid,
  assigned_admin_name text,
  assigned_admin_email text,
  
  -- Counts
  total_tasks integer,
  pending_tasks integer,
  completed_tasks integer,
  activity_count integer,
  
  -- Buyer information
  buyer_id uuid,
  buyer_name text,
  buyer_email text,
  buyer_company text,
  buyer_type text,
  buyer_priority_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    CASE 
      WHEN ap.first_name IS NOT NULL THEN ap.first_name || ' ' || ap.last_name
      ELSE ap.email
    END as assigned_admin_name,
    ap.email as assigned_admin_email,
    
    -- Task counts
    COALESCE(task_counts.total_tasks, 0) as total_tasks,
    COALESCE(task_counts.pending_tasks, 0) as pending_tasks,
    COALESCE(task_counts.completed_tasks, 0) as completed_tasks,
    
    -- Activity count
    COALESCE(activity_counts.activity_count, 0) as activity_count,
    
    -- Buyer information
    COALESCE(cr.user_id, il.mapped_to_listing_id) as buyer_id,
    COALESCE(p.first_name || ' ' || p.last_name, il.name) as buyer_name,
    COALESCE(p.email, il.email) as buyer_email,
    COALESCE(p.company, il.company_name) as buyer_company,
    p.buyer_type,
    -- Calculate priority score based on buyer type and deal characteristics
    CASE 
      WHEN p.buyer_type = 'privateEquity' THEN 5
      WHEN p.buyer_type = 'familyOffice' THEN 4
      WHEN p.buyer_type = 'searchFund' THEN 4
      WHEN p.buyer_type = 'corporate' THEN 3
      WHEN p.buyer_type = 'independentSponsor' THEN 3
      WHEN p.buyer_type = 'individual' THEN 2
      ELSE 1
    END as buyer_priority_score
    
  FROM public.deals d
  LEFT JOIN public.deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN public.listings l ON d.listing_id = l.id
  LEFT JOIN public.connection_requests cr ON d.connection_request_id = cr.id
  LEFT JOIN public.inbound_leads il ON d.inbound_lead_id = il.id
  LEFT JOIN public.profiles p ON cr.user_id = p.id
  LEFT JOIN public.profiles ap ON d.assigned_to = ap.id
  LEFT JOIN (
    SELECT 
      deal_id,
      COUNT(*) as total_tasks,
      COUNT(CASE WHEN status IN ('pending', 'in_progress') THEN 1 END) as pending_tasks,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks
    FROM public.deal_tasks 
    GROUP BY deal_id
  ) task_counts ON d.id = task_counts.deal_id
  LEFT JOIN (
    SELECT 
      deal_id,
      COUNT(*) as activity_count
    FROM public.deal_activities 
    GROUP BY deal_id
  ) activity_counts ON d.id = activity_counts.deal_id
  WHERE d.id IS NOT NULL
  ORDER BY d.created_at DESC;
END;
$function$;