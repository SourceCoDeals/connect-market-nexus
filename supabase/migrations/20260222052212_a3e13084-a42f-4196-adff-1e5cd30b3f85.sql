-- Add link tracking columns
ALTER TABLE public.data_room_access 
  ADD COLUMN IF NOT EXISTS link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_sent_to_email text,
  ADD COLUMN IF NOT EXISTS link_sent_via text;

-- Drop and recreate function
DROP FUNCTION IF EXISTS public.get_deal_access_matrix(uuid);

CREATE FUNCTION public.get_deal_access_matrix(p_deal_id uuid)
RETURNS TABLE(
  access_id uuid,
  remarketing_buyer_id uuid,
  marketplace_user_id uuid,
  contact_id uuid,
  buyer_name text,
  buyer_company text,
  contact_title text,
  can_view_teaser boolean,
  can_view_full_memo boolean,
  can_view_data_room boolean,
  fee_agreement_signed boolean,
  fee_agreement_override boolean,
  fee_agreement_override_reason text,
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  last_access_at timestamptz,
  access_token text,
  link_sent_at timestamptz,
  link_sent_to_email text,
  link_sent_via text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id as access_id,
    a.remarketing_buyer_id,
    a.marketplace_user_id,
    a.contact_id,
    COALESCE(c.name, rb.company_name, p.first_name || ' ' || p.last_name, 'Unknown') as buyer_name,
    COALESCE(rb.company_name, rb.pe_firm_name, p.company, '') as buyer_company,
    c.title as contact_title,
    COALESCE(a.can_view_teaser, false),
    COALESCE(a.can_view_full_memo, false),
    COALESCE(a.can_view_data_room, false),
    COALESCE(
      EXISTS(
        SELECT 1 FROM firm_agreements fa 
        WHERE fa.id = rb.marketplace_firm_id 
        AND fa.fee_agreement_status = 'signed'
      ), false
    ) as fee_agreement_signed,
    COALESCE(a.fee_agreement_override, false),
    a.fee_agreement_override_reason,
    a.granted_at, a.revoked_at, a.expires_at, a.last_access_at, a.access_token,
    a.link_sent_at, a.link_sent_to_email, a.link_sent_via
  FROM data_room_access a
  LEFT JOIN remarketing_buyers rb ON rb.id = a.remarketing_buyer_id
  LEFT JOIN buyer_contacts c ON c.id = a.contact_id
  LEFT JOIN profiles p ON p.id = a.marketplace_user_id
  WHERE a.deal_id = p_deal_id AND a.revoked_at IS NULL
  ORDER BY a.granted_at DESC;
$$;