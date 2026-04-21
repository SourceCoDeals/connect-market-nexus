ALTER TABLE public.match_tool_leads
  ADD COLUMN IF NOT EXISTS lead_score integer,
  ADD COLUMN IF NOT EXISTS scoring_notes text,
  ADD COLUMN IF NOT EXISTS pushed_to_all_deals_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_match_tool_leads_lead_score
  ON public.match_tool_leads(lead_score) WHERE lead_score IS NOT NULL;