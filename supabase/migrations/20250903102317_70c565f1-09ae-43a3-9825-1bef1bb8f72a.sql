-- Drop and recreate get_deals_with_details function to fix ambiguity error
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

  -- Administrative status
  nda_status text,
  fee_agreement_status text,
  followed_up boolean,
  followed_up_at timestamp with time zone,

  -- Assignment
  assigned_to uuid,
  assigned_admin_name text,
  assigned_admin_email text,

  -- Task counts
  total_tasks bigint,
  pending_tasks bigint,
  completed_tasks bigint,

  -- Activity count
  activity_count bigint,

  -- Buyer info
  buyer_id uuid,
  buyer_name text,
  buyer_email text,
  buyer_company text,
  buyer_type text,
  buyer_priority_score integer,

  -- Follow-up tracking
  next_followup_due timestamp with time zone,
  followup_overdue boolean
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    d.id AS deal_id,
    d.title AS deal_title,
    d.description AS deal_description,
    COALESCE(d.value, 0) AS deal_value,
    COALESCE(d.priority, 'medium') AS deal_priority,
    COALESCE(d.probability, 0) AS deal_probability,
    d.expected_close_date AS deal_expected_close_date,
    COALESCE(d.source, 'manual') AS deal_source,
    d.created_at AS deal_created_at,
    d.updated_at AS deal_updated_at,
    d.stage_entered_at AS deal_stage_entered_at,

    d.stage_id AS stage_id,
    COALESCE(s.name, '') AS stage_name,
    COALESCE(s.color, '#3b82f6') AS stage_color,
    COALESCE(s.position, 0) AS stage_position,

    d.listing_id AS listing_id,
    COALESCE(l.title, '') AS listing_title,
    COALESCE(l.revenue, 0) AS listing_revenue,
    COALESCE(l.ebitda, 0) AS listing_ebitda,
    l.location AS listing_location,

    d.contact_name,
    d.contact_email,
    d.contact_company,
    d.contact_phone,
    d.contact_role,

    COALESCE(d.nda_status, 'not_sent') AS nda_status,
    COALESCE(d.fee_agreement_status, 'not_sent') AS fee_agreement_status,
    COALESCE(d.followed_up, false) AS followed_up,
    d.followed_up_at,

    d.assigned_to,
    CASE WHEN p_assigned.id IS NOT NULL THEN COALESCE(p_assigned.first_name || ' ' || p_assigned.last_name, p_assigned.email) END AS assigned_admin_name,
    p_assigned.email AS assigned_admin_email,

    COALESCE((SELECT COUNT(*) FROM public.deal_tasks dt WHERE dt.deal_id = d.id), 0) AS total_tasks,
    COALESCE((SELECT COUNT(*) FROM public.deal_tasks dt WHERE dt.deal_id = d.id AND (dt.status = 'pending' OR dt.status = 'in_progress')), 0) AS pending_tasks,
    COALESCE((SELECT COUNT(*) FROM public.deal_tasks dt WHERE dt.deal_id = d.id AND dt.status = 'completed'), 0) AS completed_tasks,

    COALESCE((SELECT COUNT(*) FROM public.deal_activities da WHERE da.deal_id = d.id), 0) AS activity_count,

    NULL::uuid AS buyer_id,
    NULL::text AS buyer_name,
    NULL::text AS buyer_email,
    NULL::text AS buyer_company,
    NULL::text AS buyer_type,
    COALESCE(d.buyer_priority_score, 0) AS buyer_priority_score,

    (SELECT MIN(dt2.due_date) FROM public.deal_tasks dt2 WHERE dt2.deal_id = d.id AND (dt2.status IS NULL OR dt2.status <> 'completed')) AS next_followup_due,
    CASE 
      WHEN (SELECT MIN(dt3.due_date) FROM public.deal_tasks dt3 WHERE dt3.deal_id = d.id AND (dt3.status IS NULL OR dt3.status <> 'completed')) < NOW() THEN true 
      ELSE false 
    END AS followup_overdue
  FROM public.deals d
  LEFT JOIN public.deal_stages s ON s.id = d.stage_id
  LEFT JOIN public.listings l ON l.id = d.listing_id
  LEFT JOIN public.profiles p_assigned ON p_assigned.id = d.assigned_to
  ORDER BY COALESCE(s.position, 999), d.stage_entered_at DESC NULLS LAST;
$$;