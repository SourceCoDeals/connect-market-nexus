
-- Add columns for tracking the auto-sent combined agreement email on leads
ALTER TABLE public.connection_requests
  ADD COLUMN IF NOT EXISTS lead_agreement_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_agreement_email_status text,
  ADD COLUMN IF NOT EXISTS lead_agreement_sender_email text,
  ADD COLUMN IF NOT EXISTS lead_agreement_outbound_id uuid REFERENCES public.outbound_emails(id);
