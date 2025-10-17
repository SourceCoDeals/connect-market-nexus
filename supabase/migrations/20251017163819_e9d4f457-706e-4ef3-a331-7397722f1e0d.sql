-- Phase 1 & 2: Firm-Based Fee Agreement Tracking - Database Foundation & Sync Infrastructure

-- ============================================================================
-- 1. CREATE FIRM_AGREEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.firm_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Firm Identification
  normalized_company_name TEXT NOT NULL,
  primary_company_name TEXT NOT NULL,
  website_domain TEXT,
  email_domain TEXT,
  company_name_variations JSONB DEFAULT '[]'::jsonb,
  
  -- Fee Agreement Status
  fee_agreement_signed BOOLEAN DEFAULT false,
  fee_agreement_signed_at TIMESTAMPTZ,
  fee_agreement_signed_by UUID REFERENCES auth.users(id),
  fee_agreement_signed_by_name TEXT, -- For manual entries
  fee_agreement_email_sent BOOLEAN DEFAULT false,
  fee_agreement_email_sent_at TIMESTAMPTZ,
  fee_agreement_email_sent_by UUID REFERENCES auth.users(id),
  
  -- NDA Status
  nda_signed BOOLEAN DEFAULT false,
  nda_signed_at TIMESTAMPTZ,
  nda_signed_by UUID REFERENCES auth.users(id),
  nda_signed_by_name TEXT, -- For manual entries
  nda_email_sent BOOLEAN DEFAULT false,
  nda_email_sent_at TIMESTAMPTZ,
  nda_email_sent_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  member_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(normalized_company_name)
);

-- Add indexes for performance
CREATE INDEX idx_firm_agreements_normalized_name ON public.firm_agreements(normalized_company_name);
CREATE INDEX idx_firm_agreements_website_domain ON public.firm_agreements(website_domain) WHERE website_domain IS NOT NULL;
CREATE INDEX idx_firm_agreements_email_domain ON public.firm_agreements(email_domain) WHERE email_domain IS NOT NULL;
CREATE INDEX idx_firm_agreements_fee_status ON public.firm_agreements(fee_agreement_signed, nda_signed);

-- Enable RLS
ALTER TABLE public.firm_agreements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for firm_agreements
CREATE POLICY "Admins can manage all firm agreements"
  ON public.firm_agreements
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Approved users can view firm agreements"
  ON public.firm_agreements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND approval_status = 'approved'
      AND email_verified = true
    )
  );


-- ============================================================================
-- 2. CREATE FIRM_MEMBERS TABLE (Junction Table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.firm_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firm_agreements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Member metadata
  is_primary_contact BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  UNIQUE(firm_id, user_id)
);

-- Add indexes
CREATE INDEX idx_firm_members_firm_id ON public.firm_members(firm_id);
CREATE INDEX idx_firm_members_user_id ON public.firm_members(user_id);

-- Enable RLS
ALTER TABLE public.firm_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for firm_members
CREATE POLICY "Admins can manage firm members"
  ON public.firm_members
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users can view their own firm membership"
  ON public.firm_members
  FOR SELECT
  USING (auth.uid() = user_id);


-- ============================================================================
-- 3. COMPANY NAME NORMALIZATION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalize_company_name(company_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
BEGIN
  IF company_name IS NULL OR TRIM(company_name) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Convert to lowercase
  normalized := LOWER(TRIM(company_name));
  
  -- Remove common suffixes and punctuation
  normalized := REGEXP_REPLACE(normalized, '\s*(llc|inc|corp|corporation|ltd|limited|l\.l\.c\.|l\.p\.|llp|co\.|company)\s*\.?$', '', 'gi');
  
  -- Remove punctuation and extra spaces
  normalized := REGEXP_REPLACE(normalized, '[^a-z0-9\s]', '', 'g');
  normalized := REGEXP_REPLACE(normalized, '\s+', ' ', 'g');
  normalized := TRIM(normalized);
  
  RETURN normalized;
END;
$$;


-- ============================================================================
-- 4. EXTRACT DOMAIN FROM EMAIL/WEBSITE FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.extract_domain(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  domain TEXT;
BEGIN
  IF input_text IS NULL OR TRIM(input_text) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remove http://, https://, www.
  domain := REGEXP_REPLACE(LOWER(TRIM(input_text)), '^(https?://)?(www\.)?', '', 'i');
  
  -- Extract domain from email (after @)
  IF domain ~ '@' THEN
    domain := SPLIT_PART(domain, '@', 2);
  END IF;
  
  -- Remove path and query params from URL
  domain := SPLIT_PART(domain, '/', 1);
  domain := SPLIT_PART(domain, '?', 1);
  
  -- Remove port if present
  domain := SPLIT_PART(domain, ':', 1);
  
  RETURN NULLIF(TRIM(domain), '');
END;
$$;


-- ============================================================================
-- 5. GET OR CREATE FIRM FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_or_create_firm(
  p_company_name TEXT,
  p_website TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_firm_id UUID;
  v_normalized_name TEXT;
  v_website_domain TEXT;
  v_email_domain TEXT;
  v_variations JSONB;
BEGIN
  -- Normalize inputs
  v_normalized_name := normalize_company_name(p_company_name);
  v_website_domain := extract_domain(p_website);
  v_email_domain := extract_domain(p_email);
  
  IF v_normalized_name IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Strategy 1: Exact normalized name match
  SELECT id INTO v_firm_id
  FROM public.firm_agreements
  WHERE normalized_company_name = v_normalized_name
  LIMIT 1;
  
  IF v_firm_id IS NOT NULL THEN
    -- Update domains if not set
    UPDATE public.firm_agreements
    SET 
      website_domain = COALESCE(website_domain, v_website_domain),
      email_domain = COALESCE(email_domain, v_email_domain),
      company_name_variations = CASE
        WHEN NOT (company_name_variations @> to_jsonb(p_company_name))
        THEN company_name_variations || to_jsonb(p_company_name)
        ELSE company_name_variations
      END,
      updated_at = NOW()
    WHERE id = v_firm_id;
    
    RETURN v_firm_id;
  END IF;
  
  -- Strategy 2: Match by website domain (if provided and not generic)
  IF v_website_domain IS NOT NULL 
     AND v_website_domain NOT IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com') THEN
    SELECT id INTO v_firm_id
    FROM public.firm_agreements
    WHERE website_domain = v_website_domain
    LIMIT 1;
    
    IF v_firm_id IS NOT NULL THEN
      RETURN v_firm_id;
    END IF;
  END IF;
  
  -- Strategy 3: Match by email domain (if provided and not generic)
  IF v_email_domain IS NOT NULL 
     AND v_email_domain NOT IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com') THEN
    SELECT id INTO v_firm_id
    FROM public.firm_agreements
    WHERE email_domain = v_email_domain
    LIMIT 1;
    
    IF v_firm_id IS NOT NULL THEN
      RETURN v_firm_id;
    END IF;
  END IF;
  
  -- No match found, create new firm
  v_variations := to_jsonb(ARRAY[p_company_name]);
  
  INSERT INTO public.firm_agreements (
    normalized_company_name,
    primary_company_name,
    website_domain,
    email_domain,
    company_name_variations
  ) VALUES (
    v_normalized_name,
    p_company_name,
    v_website_domain,
    v_email_domain,
    v_variations
  )
  RETURNING id INTO v_firm_id;
  
  RETURN v_firm_id;
END;
$$;


-- ============================================================================
-- 6. UPDATE FEE AGREEMENT FIRM STATUS FUNCTION (With Cascading)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_fee_agreement_firm_status(
  p_firm_id UUID,
  p_is_signed BOOLEAN,
  p_signed_by_user_id UUID DEFAULT NULL,
  p_signed_by_name TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_member_record RECORD;
BEGIN
  -- Get current admin
  v_admin_id := auth.uid();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Only admins can update firm fee agreement status';
  END IF;
  
  -- Update firm_agreements table
  UPDATE public.firm_agreements
  SET 
    fee_agreement_signed = p_is_signed,
    fee_agreement_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
    fee_agreement_signed_by = CASE WHEN p_is_signed THEN COALESCE(p_signed_by_user_id, v_admin_id) ELSE NULL END,
    fee_agreement_signed_by_name = CASE WHEN p_is_signed THEN p_signed_by_name ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_firm_id;
  
  -- Cascade to all firm members' profiles
  FOR v_member_record IN 
    SELECT user_id FROM public.firm_members WHERE firm_id = p_firm_id
  LOOP
    UPDATE public.profiles
    SET 
      fee_agreement_signed = p_is_signed,
      fee_agreement_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_member_record.user_id;
    
    -- Cascade to all connection_requests for this user
    UPDATE public.connection_requests
    SET 
      lead_fee_agreement_signed = p_is_signed,
      lead_fee_agreement_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      lead_fee_agreement_signed_by = CASE WHEN p_is_signed THEN COALESCE(p_signed_by_user_id, v_admin_id) ELSE NULL END,
      updated_at = NOW()
    WHERE user_id = v_member_record.user_id;
    
    -- Cascade to all deals for this user (via connection_requests)
    UPDATE public.deals
    SET 
      fee_agreement_status = CASE 
        WHEN p_is_signed THEN 'signed'::text
        ELSE 'not_sent'::text
      END,
      updated_at = NOW()
    WHERE connection_request_id IN (
      SELECT id FROM public.connection_requests WHERE user_id = v_member_record.user_id
    );
  END LOOP;
  
  -- Log the action
  INSERT INTO public.fee_agreement_logs (
    user_id,
    admin_id,
    action_type,
    notes,
    metadata
  )
  SELECT 
    v_member_record.user_id,
    v_admin_id,
    CASE WHEN p_is_signed THEN 'signed' ELSE 'revoked' END,
    p_admin_notes,
    jsonb_build_object(
      'firm_update', true,
      'firm_id', p_firm_id,
      'signed_by_name', p_signed_by_name
    )
  FROM public.firm_members v_member_record
  WHERE v_member_record.firm_id = p_firm_id;
  
  RETURN TRUE;
END;
$$;


-- ============================================================================
-- 7. UPDATE NDA FIRM STATUS FUNCTION (With Cascading)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_nda_firm_status(
  p_firm_id UUID,
  p_is_signed BOOLEAN,
  p_signed_by_user_id UUID DEFAULT NULL,
  p_signed_by_name TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_member_record RECORD;
BEGIN
  -- Get current admin
  v_admin_id := auth.uid();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Only admins can update firm NDA status';
  END IF;
  
  -- Update firm_agreements table
  UPDATE public.firm_agreements
  SET 
    nda_signed = p_is_signed,
    nda_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
    nda_signed_by = CASE WHEN p_is_signed THEN COALESCE(p_signed_by_user_id, v_admin_id) ELSE NULL END,
    nda_signed_by_name = CASE WHEN p_is_signed THEN p_signed_by_name ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_firm_id;
  
  -- Cascade to all firm members' profiles
  FOR v_member_record IN 
    SELECT user_id FROM public.firm_members WHERE firm_id = p_firm_id
  LOOP
    UPDATE public.profiles
    SET 
      nda_signed = p_is_signed,
      nda_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_member_record.user_id;
    
    -- Cascade to all connection_requests for this user
    UPDATE public.connection_requests
    SET 
      lead_nda_signed = p_is_signed,
      lead_nda_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      lead_nda_signed_by = CASE WHEN p_is_signed THEN COALESCE(p_signed_by_user_id, v_admin_id) ELSE NULL END,
      updated_at = NOW()
    WHERE user_id = v_member_record.user_id;
    
    -- Cascade to all deals for this user (via connection_requests)
    UPDATE public.deals
    SET 
      nda_status = CASE 
        WHEN p_is_signed THEN 'signed'::text
        ELSE 'not_sent'::text
      END,
      updated_at = NOW()
    WHERE connection_request_id IN (
      SELECT id FROM public.connection_requests WHERE user_id = v_member_record.user_id
    );
  END LOOP;
  
  -- Log the action
  INSERT INTO public.nda_logs (
    user_id,
    admin_id,
    action_type,
    notes,
    metadata
  )
  SELECT 
    v_member_record.user_id,
    v_admin_id,
    CASE WHEN p_is_signed THEN 'signed' ELSE 'revoked' END,
    p_admin_notes,
    jsonb_build_object(
      'firm_update', true,
      'firm_id', p_firm_id,
      'signed_by_name', p_signed_by_name
    )
  FROM public.firm_members v_member_record
  WHERE v_member_record.firm_id = p_firm_id;
  
  RETURN TRUE;
END;
$$;


-- ============================================================================
-- 8. TRIGGER TO UPDATE FIRM MEMBER COUNT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_firm_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.firm_agreements
    SET member_count = member_count + 1, updated_at = NOW()
    WHERE id = NEW.firm_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.firm_agreements
    SET member_count = member_count - 1, updated_at = NOW()
    WHERE id = OLD.firm_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_firm_member_count
  AFTER INSERT OR DELETE ON public.firm_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_firm_member_count();


-- ============================================================================
-- 9. AUTO-LINK USERS TO FIRMS ON PROFILE UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_link_user_to_firm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_firm_id UUID;
BEGIN
  -- Only process if company is set
  IF NEW.company IS NOT NULL AND TRIM(NEW.company) != '' THEN
    -- Get or create firm
    v_firm_id := public.get_or_create_firm(
      NEW.company,
      NEW.website,
      NEW.email
    );
    
    IF v_firm_id IS NOT NULL THEN
      -- Link user to firm if not already linked
      INSERT INTO public.firm_members (firm_id, user_id, added_by)
      VALUES (v_firm_id, NEW.id, auth.uid())
      ON CONFLICT (firm_id, user_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_link_user_to_firm
  AFTER INSERT OR UPDATE OF company, website, email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_user_to_firm();


-- ============================================================================
-- 10. BACKFILL FIRMS FROM EXISTING PROFILES
-- ============================================================================
DO $$
DECLARE
  v_profile_record RECORD;
  v_firm_id UUID;
BEGIN
  FOR v_profile_record IN 
    SELECT DISTINCT ON (normalize_company_name(company))
      id, email, company, website, 
      fee_agreement_signed, fee_agreement_signed_at,
      nda_signed, nda_signed_at
    FROM public.profiles
    WHERE company IS NOT NULL 
      AND TRIM(company) != ''
      AND approval_status = 'approved'
    ORDER BY normalize_company_name(company), created_at
  LOOP
    -- Create or get firm
    v_firm_id := public.get_or_create_firm(
      v_profile_record.company,
      v_profile_record.website,
      v_profile_record.email
    );
    
    IF v_firm_id IS NOT NULL THEN
      -- Set initial firm status from first user
      UPDATE public.firm_agreements
      SET 
        fee_agreement_signed = COALESCE(fee_agreement_signed, v_profile_record.fee_agreement_signed),
        fee_agreement_signed_at = COALESCE(fee_agreement_signed_at, v_profile_record.fee_agreement_signed_at),
        nda_signed = COALESCE(nda_signed, v_profile_record.nda_signed),
        nda_signed_at = COALESCE(nda_signed_at, v_profile_record.nda_signed_at)
      WHERE id = v_firm_id;
    END IF;
  END LOOP;
END $$;


-- ============================================================================
-- 11. LINK ALL USERS TO THEIR FIRMS
-- ============================================================================
DO $$
DECLARE
  v_profile_record RECORD;
  v_firm_id UUID;
BEGIN
  FOR v_profile_record IN 
    SELECT id, email, company, website
    FROM public.profiles
    WHERE company IS NOT NULL 
      AND TRIM(company) != ''
      AND approval_status = 'approved'
  LOOP
    v_firm_id := public.get_or_create_firm(
      v_profile_record.company,
      v_profile_record.website,
      v_profile_record.email
    );
    
    IF v_firm_id IS NOT NULL THEN
      INSERT INTO public.firm_members (firm_id, user_id)
      VALUES (v_firm_id, v_profile_record.id)
      ON CONFLICT (firm_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;


-- ============================================================================
-- 12. ADD firm_id TO fee_agreement_logs and nda_logs
-- ============================================================================
ALTER TABLE public.fee_agreement_logs ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firm_agreements(id);
ALTER TABLE public.nda_logs ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firm_agreements(id);

CREATE INDEX IF NOT EXISTS idx_fee_agreement_logs_firm_id ON public.fee_agreement_logs(firm_id);
CREATE INDEX IF NOT EXISTS idx_nda_logs_firm_id ON public.nda_logs(firm_id);