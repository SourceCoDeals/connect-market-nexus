-- =============================================================================
-- CONTACT MANAGEMENT SCHEMA ALIGNMENT
-- Creates 3-tier hierarchy: PE Firm → Platform → Contacts
-- =============================================================================

-- 1. CREATE PE FIRM CONTACTS TABLE
-- For contacts at the PE Firm level (Partners, Principals, Directors, etc.)
CREATE TABLE IF NOT EXISTS public.pe_firm_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pe_firm_id UUID REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  role_category TEXT CHECK (role_category IN (
    'partner', 'principal', 'director', 'vp', 
    'associate', 'analyst', 'operating_partner', 'other'
  )),
  priority_level INTEGER DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5),
  is_primary_contact BOOLEAN DEFAULT FALSE,
  linkedin_url TEXT,
  email TEXT,
  phone TEXT,
  email_confidence TEXT CHECK (email_confidence IN ('Verified', 'Likely', 'Guessed')),
  source TEXT,
  source_url TEXT,
  bio_url TEXT,
  is_deal_team BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. CREATE PLATFORM CONTACTS TABLE
-- For contacts at the Platform company level (C-suite, Corp Dev, Business Dev, etc.)
CREATE TABLE IF NOT EXISTS public.platform_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id UUID REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  role_category TEXT CHECK (role_category IN (
    'ceo', 'cfo', 'coo', 'president', 'vp', 
    'director', 'manager', 'corp_dev', 'business_dev', 'other'
  )),
  priority_level INTEGER DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5),
  is_primary_contact BOOLEAN DEFAULT FALSE,
  linkedin_url TEXT,
  email TEXT,
  phone TEXT,
  email_confidence TEXT CHECK (email_confidence IN ('Verified', 'Likely', 'Guessed')),
  source TEXT,
  source_url TEXT,
  bio_url TEXT,
  is_deal_team BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_pe_firm_contacts_firm ON public.pe_firm_contacts(pe_firm_id);
CREATE INDEX IF NOT EXISTS idx_pe_firm_contacts_buyer ON public.pe_firm_contacts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_pe_firm_contacts_email ON public.pe_firm_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pe_firm_contacts_priority ON public.pe_firm_contacts(priority_level DESC);
CREATE INDEX IF NOT EXISTS idx_pe_firm_contacts_role ON public.pe_firm_contacts(role_category);

CREATE INDEX IF NOT EXISTS idx_platform_contacts_platform ON public.platform_contacts(platform_id);
CREATE INDEX IF NOT EXISTS idx_platform_contacts_buyer ON public.platform_contacts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_platform_contacts_email ON public.platform_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_contacts_priority ON public.platform_contacts(priority_level DESC);
CREATE INDEX IF NOT EXISTS idx_platform_contacts_role ON public.platform_contacts(role_category);

-- 4. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.pe_firm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_contacts ENABLE ROW LEVEL SECURITY;

-- 5. CREATE RLS POLICIES FOR ADMIN ACCESS
CREATE POLICY "Admins can manage PE firm contacts" 
  ON public.pe_firm_contacts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage platform contacts" 
  ON public.platform_contacts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 6. CREATE UPDATE TRIGGERS FOR updated_at
CREATE TRIGGER update_pe_firm_contacts_updated_at
  BEFORE UPDATE ON public.pe_firm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_contacts_updated_at
  BEFORE UPDATE ON public.platform_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. ADD CONTACT DISCOVERY METADATA TO BUYERS TABLE
-- Track email pattern detection results for automated inference
ALTER TABLE public.remarketing_buyers 
  ADD COLUMN IF NOT EXISTS detected_email_pattern TEXT,
  ADD COLUMN IF NOT EXISTS email_domain TEXT,
  ADD COLUMN IF NOT EXISTS last_contact_discovery_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS contact_discovery_status TEXT DEFAULT 'pending'
    CHECK (contact_discovery_status IN ('pending', 'in_progress', 'completed', 'failed', 'no_contacts'));

-- 8. ADD COMMENTS FOR DOCUMENTATION
COMMENT ON TABLE public.pe_firm_contacts IS 'Contacts at PE Firm level (Partners, VPs, Associates, etc.)';
COMMENT ON TABLE public.platform_contacts IS 'Contacts at Platform company level (C-suite, Corp Dev, etc.)';
COMMENT ON COLUMN public.pe_firm_contacts.priority_level IS 'Outreach priority: 1=Partner, 2=Principal/VP, 3=Associate, 4=Analyst, 5=Other';
COMMENT ON COLUMN public.platform_contacts.priority_level IS 'Outreach priority: 1=C-suite, 2=Corp Dev, 3=VP, 4=Director, 5=Other';
COMMENT ON COLUMN public.pe_firm_contacts.email_confidence IS 'Verified=explicit, Likely=2+ pattern matches, Guessed=1 pattern match';
COMMENT ON COLUMN public.remarketing_buyers.detected_email_pattern IS 'Detected email format: firstlast, first.last, first_last, or flast';