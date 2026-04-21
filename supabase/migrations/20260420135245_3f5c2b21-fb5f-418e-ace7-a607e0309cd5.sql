CREATE OR REPLACE FUNCTION public.get_match_tool_lead_outreach_tracking(lead_id uuid)
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
  SELECT oe.id,
         oe.status,
         oe.sender_email,
         oe.sender_name,
         oe.accepted_at,
         oe.delivered_at,
         oe.opened_at,
         oe.failed_at,
         oe.last_error,
         oe.created_at
  FROM public.outbound_emails oe
  WHERE oe.metadata->>'matchToolLeadId' = lead_id::text
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY oe.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_match_tool_lead_outreach_tracking(uuid) TO authenticated;