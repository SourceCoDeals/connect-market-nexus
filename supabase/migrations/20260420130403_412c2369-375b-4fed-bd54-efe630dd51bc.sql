ALTER TABLE public.match_tool_leads
  ADD COLUMN IF NOT EXISTS outreach_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_email_status text,
  ADD COLUMN IF NOT EXISTS outreach_sender_email text,
  ADD COLUMN IF NOT EXISTS outreach_outbound_id uuid,
  ADD COLUMN IF NOT EXISTS outreach_send_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outreach_last_template text,
  ADD COLUMN IF NOT EXISTS outreach_hook_kind text;

CREATE INDEX IF NOT EXISTS idx_match_tool_leads_outreach_status
  ON public.match_tool_leads (outreach_email_status)
  WHERE outreach_email_status IS NOT NULL;