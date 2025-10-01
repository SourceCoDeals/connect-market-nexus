-- Phase 1: Update Default Pipeline Stages (Fixed)
-- Rename existing stages
UPDATE public.deal_stages 
SET name = 'Approved', updated_at = NOW()
WHERE name = 'Qualified';

UPDATE public.deal_stages 
SET name = 'Info Sent', updated_at = NOW()
WHERE name = 'Information Sent';

-- Add new stage "Buyer/Seller Call" between "Info Sent" and "Due Diligence"
-- First, temporarily shift all stages after position 3 to high numbers to avoid conflicts
UPDATE public.deal_stages 
SET position = position + 100, updated_at = NOW()
WHERE position >= 4;

-- Insert the new stage at position 4
INSERT INTO public.deal_stages (name, description, color, position, is_active)
VALUES ('Buyer/Seller Call', 'Scheduled or completed call between buyer and seller', '#8b5cf6', 4, true)
ON CONFLICT DO NOTHING;

-- Now shift the temporarily moved stages back down to proper positions
UPDATE public.deal_stages 
SET position = position - 99, updated_at = NOW()
WHERE position >= 104;

-- Phase 4: Add Performance Indexes
CREATE INDEX IF NOT EXISTS idx_deals_contact_company ON public.deals(contact_company);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON public.deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON public.deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_stage_entered_at ON public.deals(stage_entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_updated_at ON public.deals(updated_at DESC);

-- Phase 4: Drop and recreate Enhanced RPC Function for better filtering
DROP FUNCTION IF EXISTS public.get_deals_with_details();

CREATE FUNCTION public.get_deals_with_details()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  value numeric,
  probability integer,
  expected_close_date date,
  priority text,
  source text,
  stage_id uuid,
  stage_name text,
  stage_color text,
  stage_position integer,
  listing_id uuid,
  listing_title text,
  listing_category text,
  listing_location text,
  listing_revenue numeric,
  listing_ebitda numeric,
  connection_request_id uuid,
  contact_name text,
  contact_email text,
  contact_company text,
  contact_phone text,
  contact_role text,
  buyer_name text,
  buyer_email text,
  buyer_company text,
  buyer_type text,
  buyer_phone text,
  buyer_priority_score integer,
  assigned_to uuid,
  assigned_admin_name text,
  assigned_admin_email text,
  nda_status text,
  fee_agreement_status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  stage_entered_at timestamp with time zone,
  followed_up boolean,
  followed_up_at timestamp with time zone,
  followed_up_by uuid,
  metadata jsonb,
  pending_tasks_count bigint,
  completed_tasks_count bigint,
  total_activities_count bigint,
  last_activity_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.description,
    d.value,
    d.probability,
    d.expected_close_date,
    d.priority,
    d.source,
    d.stage_id,
    ds.name as stage_name,
    ds.color as stage_color,
    ds.position as stage_position,
    d.listing_id,
    l.title as listing_title,
    l.category as listing_category,
    l.location as listing_location,
    l.revenue as listing_revenue,
    l.ebitda as listing_ebitda,
    d.connection_request_id,
    d.contact_name,
    d.contact_email,
    d.contact_company,
    d.contact_phone,
    d.contact_role,
    COALESCE(p.first_name || ' ' || p.last_name, p.email) as buyer_name,
    p.email as buyer_email,
    p.company as buyer_company,
    p.buyer_type,
    p.phone_number as buyer_phone,
    d.buyer_priority_score,
    d.assigned_to,
    COALESCE(admin_p.first_name || ' ' || admin_p.last_name, admin_p.email) as assigned_admin_name,
    admin_p.email as assigned_admin_email,
    d.nda_status,
    d.fee_agreement_status,
    d.created_at,
    d.updated_at,
    d.stage_entered_at,
    d.followed_up,
    d.followed_up_at,
    d.followed_up_by,
    d.metadata,
    COUNT(DISTINCT CASE WHEN dt.status = 'pending' THEN dt.id END) as pending_tasks_count,
    COUNT(DISTINCT CASE WHEN dt.status = 'completed' THEN dt.id END) as completed_tasks_count,
    COUNT(DISTINCT da.id) as total_activities_count,
    MAX(da.created_at) as last_activity_at
  FROM deals d
  LEFT JOIN deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN listings l ON d.listing_id = l.id
  LEFT JOIN connection_requests cr ON d.connection_request_id = cr.id
  LEFT JOIN profiles p ON cr.user_id = p.id
  LEFT JOIN profiles admin_p ON d.assigned_to = admin_p.id
  LEFT JOIN deal_tasks dt ON d.id = dt.deal_id
  LEFT JOIN deal_activities da ON d.id = da.deal_id
  GROUP BY 
    d.id, d.title, d.description, d.value, d.probability, d.expected_close_date,
    d.priority, d.source, d.stage_id, ds.name, ds.color, ds.position,
    d.listing_id, l.title, l.category, l.location, l.revenue, l.ebitda,
    d.connection_request_id, d.contact_name, d.contact_email, d.contact_company,
    d.contact_phone, d.contact_role, p.first_name, p.last_name, p.email,
    p.company, p.buyer_type, p.phone_number, d.buyer_priority_score,
    d.assigned_to, admin_p.first_name, admin_p.last_name, admin_p.email,
    d.nda_status, d.fee_agreement_status, d.created_at, d.updated_at,
    d.stage_entered_at, d.followed_up, d.followed_up_at, d.followed_up_by, d.metadata
  ORDER BY d.created_at DESC;
END;
$$;