-- Add outreach email tracking columns to valuation_leads
ALTER TABLE public.valuation_leads
  ADD COLUMN IF NOT EXISTS outreach_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_email_status text,
  ADD COLUMN IF NOT EXISTS outreach_sender_email text,
  ADD COLUMN IF NOT EXISTS outreach_outbound_id uuid,
  ADD COLUMN IF NOT EXISTS outreach_send_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outreach_last_template text;

CREATE INDEX IF NOT EXISTS idx_valuation_leads_outreach_outbound_id
  ON public.valuation_leads(outreach_outbound_id)
  WHERE outreach_outbound_id IS NOT NULL;

-- RPC: returns all outbound_emails rows tied to this valuation lead via metadata
CREATE OR REPLACE FUNCTION public.get_valuation_lead_outreach_tracking(lead_id uuid)
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
  SELECT
    oe.id,
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
  WHERE oe.metadata->>'valuationLeadId' = lead_id::text
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY oe.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_valuation_lead_outreach_tracking(uuid) TO authenticated;