ALTER TABLE public.valuation_leads
  ADD COLUMN IF NOT EXISTS initial_unlock_at timestamptz,
  ADD COLUMN IF NOT EXISTS submission_count integer NOT NULL DEFAULT 1;