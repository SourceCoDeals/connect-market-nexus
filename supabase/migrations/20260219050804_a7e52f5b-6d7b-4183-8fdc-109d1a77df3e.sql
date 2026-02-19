
ALTER TABLE public.valuation_leads
ADD COLUMN IF NOT EXISTS is_priority_target boolean DEFAULT false;
