-- Add valuation_lead_id attribution column to contact_activities
ALTER TABLE public.contact_activities
  ADD COLUMN IF NOT EXISTS valuation_lead_id uuid REFERENCES public.valuation_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contact_activities_valuation_lead_id
  ON public.contact_activities(valuation_lead_id)
  WHERE valuation_lead_id IS NOT NULL;

-- Backfill from email match against valuation_leads (covers historical PhoneBurner calls)
UPDATE public.contact_activities ca
SET valuation_lead_id = vl.id
FROM public.valuation_leads vl
WHERE ca.valuation_lead_id IS NULL
  AND ca.contact_email IS NOT NULL
  AND lower(ca.contact_email) = lower(vl.email)
  AND ca.source_system = 'phoneburner';