-- Add archive_reason column to valuation_leads table
ALTER TABLE public.valuation_leads
  ADD COLUMN IF NOT EXISTS archive_reason text DEFAULT NULL;
