-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS public.get_deals_with_details();

-- Create contact tracking table for real contact history
CREATE TABLE IF NOT EXISTS public.deal_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('email', 'phone', 'meeting', 'note')),
  admin_id UUID NOT NULL,
  contact_details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for deal_contacts
CREATE POLICY "Admins can manage deal contacts"
  ON public.deal_contacts
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_deal_contacts_updated_at
  BEFORE UPDATE ON public.deal_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Recreate function with enhanced buyer information and real time data
CREATE OR REPLACE FUNCTION public.get_deals_with_details()
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
  -- Contact information
  contact_name TEXT,
  contact_email TEXT,
  contact_company TEXT,
  contact_phone TEXT,
  contact_role TEXT,
  -- Administrative status information
  nda_status TEXT,
  fee_agreement_status TEXT,
  followed_up BOOLEAN,
  followed_up_at TIMESTAMP WITH TIME ZONE,
  -- Assignment information
  assigned_to UUID,
  assigned_admin_name TEXT,
  assigned_admin_email TEXT,
  -- Task counts
  total_tasks BIGINT,
  pending_tasks BIGINT,
  completed_tasks BIGINT,
  -- Activity count
  activity_count BIGINT,
  -- Enhanced buyer information from profiles
  buyer_id UUID,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_company TEXT,
  buyer_type TEXT,
  buyer_priority_score INTEGER,
  -- Real contact tracking
  last_contact_at TIMESTAMP WITH TIME ZONE,
  last_contact_type TEXT,
  next_followup_due TIMESTAMP WITH TIME ZONE,
  followup_overdue BOOLEAN
) 
LANGUAGE SQL 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT 
    d.id AS deal_id,
    d.title AS deal_title,
    d.description AS deal_description,
    d.value AS deal_value,
    d.priority AS deal_priority,
    d.probability AS deal_probability,
    d.expected_close_date AS deal_expected_close_date,
    d.source AS deal_source,
    d.created_at AS deal_created_at,
    d.updated_at AS deal_updated_at,
    d.stage_entered_at AS deal_stage_entered_at,
    
    -- Stage information
    ds.id AS stage_id,
    ds.name AS stage_name,
    ds.color AS stage_color,
    ds.position AS stage_position,
    
    -- Listing information
    l.id AS listing_id,
    l.title AS listing_title,
    l.revenue AS listing_revenue,
    l.ebitda AS listing_ebitda,
    l.location AS listing_location,
    
    -- Contact information (prefer deal contact info over buyer profile)
    COALESCE(d.contact_name, p.first_name || ' ' || p.last_name) AS contact_name,
    COALESCE(d.contact_email, p.email) AS contact_email,
    COALESCE(d.contact_company, p.company) AS contact_company,
    COALESCE(d.contact_phone, p.phone_number) AS contact_phone,
    d.contact_role AS contact_role,
    
    -- Administrative status information
    d.nda_status,
    d.fee_agreement_status,
    d.followed_up,
    d.followed_up_at,
    
    -- Assignment information
    d.assigned_to,
    ap.first_name || ' ' || ap.last_name AS assigned_admin_name,
    ap.email AS assigned_admin_email,
    
    -- Task counts
    COALESCE(task_counts.total_tasks, 0) AS total_tasks,
    COALESCE(task_counts.pending_tasks, 0) AS pending_tasks,
    COALESCE(task_counts.completed_tasks, 0) AS completed_tasks,
    
    -- Activity count
    COALESCE(activity_counts.activity_count, 0) AS activity_count,
    
    -- Enhanced buyer information from connection request -> profiles
    p.id AS buyer_id,
    p.first_name || ' ' || p.last_name AS buyer_name,
    p.email AS buyer_email,
    p.company AS buyer_company,
    p.buyer_type AS buyer_type,
    d.buyer_priority_score,
    
    -- Real contact tracking from deal_contacts
    last_contact.created_at AS last_contact_at,
    last_contact.contact_type AS last_contact_type,
    
    -- Calculate next followup due (example: 7 days after creation if no contact made)
    CASE 
      WHEN last_contact.created_at IS NULL THEN d.created_at + INTERVAL '7 days'
      ELSE last_contact.created_at + INTERVAL '14 days'
    END AS next_followup_due,
    
    -- Calculate if followup is overdue
    CASE 
      WHEN last_contact.created_at IS NULL THEN d.created_at + INTERVAL '7 days' < now()
      ELSE last_contact.created_at + INTERVAL '14 days' < now()
    END AS followup_overdue
    
  FROM deals d
  LEFT JOIN deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN listings l ON d.listing_id = l.id
  LEFT JOIN connection_requests cr ON d.connection_request_id = cr.id
  LEFT JOIN profiles p ON cr.user_id = p.id
  LEFT JOIN profiles ap ON d.assigned_to = ap.id
  LEFT JOIN (
    SELECT 
      deal_id,
      COUNT(*) AS total_tasks,
      COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')) AS pending_tasks,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks
    FROM deal_tasks
    GROUP BY deal_id
  ) task_counts ON d.id = task_counts.deal_id
  LEFT JOIN (
    SELECT 
      deal_id,
      COUNT(*) AS activity_count
    FROM deal_activities
    GROUP BY deal_id
  ) activity_counts ON d.id = activity_counts.deal_id
  LEFT JOIN LATERAL (
    SELECT created_at, contact_type
    FROM deal_contacts dc
    WHERE dc.deal_id = d.id
    ORDER BY created_at DESC
    LIMIT 1
  ) last_contact ON true
  ORDER BY d.created_at DESC;
$$;