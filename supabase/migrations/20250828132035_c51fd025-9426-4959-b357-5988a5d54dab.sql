-- Create inbound_leads table for manual/webflow lead intake
CREATE TABLE IF NOT EXISTS public.inbound_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT,
  phone_number TEXT,
  role TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'manual', -- e.g., 'webflow' | 'manual'
  source_form_name TEXT,
  mapped_to_listing_id UUID REFERENCES public.listings(id),
  mapped_to_listing_title TEXT,
  mapped_at TIMESTAMPTZ,
  mapped_by UUID REFERENCES public.profiles(id),
  converted_to_request_id UUID REFERENCES public.connection_requests(id),
  converted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | mapped | converted | archived
  priority_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.inbound_leads ENABLE ROW LEVEL SECURITY;

-- Admins manage all inbound leads
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inbound_leads' AND policyname = 'Admins can manage inbound leads'
  ) THEN
    CREATE POLICY "Admins can manage inbound leads"
    ON public.inbound_leads
    FOR ALL
    USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));
  END IF;
END $$;

-- trigger for updated_at
DROP TRIGGER IF EXISTS update_inbound_leads_updated_at ON public.inbound_leads;
CREATE TRIGGER update_inbound_leads_updated_at
BEFORE UPDATE ON public.inbound_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- indexes
CREATE INDEX IF NOT EXISTS idx_inbound_leads_email ON public.inbound_leads (email);
CREATE INDEX IF NOT EXISTS idx_inbound_leads_created_at ON public.inbound_leads (created_at);
CREATE INDEX IF NOT EXISTS idx_inbound_leads_status ON public.inbound_leads (status);
CREATE INDEX IF NOT EXISTS idx_inbound_leads_mapped_listing ON public.inbound_leads (mapped_to_listing_id);

-- realtime
ALTER TABLE public.inbound_leads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbound_leads;


-- Create connection_request_contacts table for associated contacts (admin-only)
CREATE TABLE IF NOT EXISTS public.connection_request_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_request_id UUID NOT NULL REFERENCES public.connection_requests(id) ON DELETE CASCADE,
  related_request_id UUID NOT NULL REFERENCES public.connection_requests(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- 'same_company' | 'same_listing'
  relationship_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT connection_request_contacts_unique UNIQUE (primary_request_id, related_request_id)
);

-- RLS
ALTER TABLE public.connection_request_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'connection_request_contacts' AND policyname = 'Admins can manage connection request contacts'
  ) THEN
    CREATE POLICY "Admins can manage connection request contacts"
    ON public.connection_request_contacts
    FOR ALL
    USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));
  END IF;
END $$;

-- indexes
CREATE INDEX IF NOT EXISTS idx_crc_primary ON public.connection_request_contacts (primary_request_id);
CREATE INDEX IF NOT EXISTS idx_crc_related ON public.connection_request_contacts (related_request_id);
CREATE INDEX IF NOT EXISTS idx_crc_type ON public.connection_request_contacts (relationship_type);

-- realtime
ALTER TABLE public.connection_request_contacts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_request_contacts;