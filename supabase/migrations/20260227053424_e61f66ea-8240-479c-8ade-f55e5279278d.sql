-- Add new columns to contact_activities for full PhoneBurner data
ALTER TABLE public.contact_activities ADD COLUMN IF NOT EXISTS call_transcript TEXT;
ALTER TABLE public.contact_activities ADD COLUMN IF NOT EXISTS call_direction TEXT;
ALTER TABLE public.contact_activities ADD COLUMN IF NOT EXISTS call_connected BOOLEAN;
ALTER TABLE public.contact_activities ADD COLUMN IF NOT EXISTS recording_url_public TEXT;
ALTER TABLE public.contact_activities ADD COLUMN IF NOT EXISTS phoneburner_status TEXT;
ALTER TABLE public.contact_activities ADD COLUMN IF NOT EXISTS contact_notes TEXT;
ALTER TABLE public.contact_activities ADD COLUMN IF NOT EXISTS phoneburner_lead_id TEXT;

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_contact_activities_contact_id ON public.contact_activities (contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_activity_type ON public.contact_activities (activity_type);
CREATE INDEX IF NOT EXISTS idx_contact_activities_source_system ON public.contact_activities (source_system);