
CREATE OR REPLACE FUNCTION public.get_lead_agreement_tracking(cr_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  sender_email text,
  sender_name text,
  accepted_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oe.id, oe.status::text, oe.sender_email, oe.sender_name,
         oe.accepted_at, oe.delivered_at, oe.opened_at, oe.failed_at,
         oe.last_error, oe.created_at
  FROM outbound_emails oe
  WHERE oe.template_name = 'lead_agreement_combined'
    AND oe.metadata->>'connectionRequestId' = cr_id::text
  ORDER BY oe.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_lead_agreement_tracking(uuid) TO authenticated;
