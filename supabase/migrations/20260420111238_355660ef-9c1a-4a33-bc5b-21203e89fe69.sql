-- Add parity columns to match_tool_leads
ALTER TABLE public.match_tool_leads
  ADD COLUMN IF NOT EXISTS is_priority_target boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quality_label text,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS exclusion_reason text;

-- quality_tier already exists per types? Add defensively
ALTER TABLE public.match_tool_leads
  ADD COLUMN IF NOT EXISTS quality_tier text;

-- Auto-quarantine trigger: flag obvious junk on insert
CREATE OR REPLACE FUNCTION public.match_tool_leads_auto_quarantine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_website_lower text := lower(coalesce(NEW.website, ''));
  v_name_lower    text := lower(coalesce(NEW.full_name, ''));
  v_business_lower text := lower(coalesce(NEW.business_name, ''));
  v_email_lower   text := lower(coalesce(NEW.email, ''));
BEGIN
  -- Skip if already explicitly excluded
  IF NEW.excluded IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Junk websites
  IF v_website_lower IN ('test.com', 'test.net', 'example.com', 'example.org', 'test.test', 'a.com', 'aa.com')
     OR v_website_lower LIKE 'test.%'
     OR v_website_lower LIKE '%lovabletest%'
     OR v_website_lower LIKE '%e2etest%'
  THEN
    NEW.excluded := true;
    NEW.exclusion_reason := 'invalid_website';
    RETURN NEW;
  END IF;

  -- Junk names
  IF v_name_lower IN ('test', 'test test', 'asdf', 'qwerty', 'aaa', 'aa')
     OR v_business_lower IN ('test', 'asdf', 'qwerty')
  THEN
    NEW.excluded := true;
    NEW.exclusion_reason := 'invalid_name';
    RETURN NEW;
  END IF;

  -- Junk emails
  IF v_email_lower LIKE '%@test.%'
     OR v_email_lower LIKE '%@example.%'
     OR v_email_lower LIKE '%lovabletest%'
     OR v_email_lower LIKE '%e2etest%'
     OR v_email_lower LIKE 'test@%'
  THEN
    NEW.excluded := true;
    NEW.exclusion_reason := 'invalid_email';
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_tool_leads_auto_quarantine ON public.match_tool_leads;
CREATE TRIGGER trg_match_tool_leads_auto_quarantine
  BEFORE INSERT ON public.match_tool_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.match_tool_leads_auto_quarantine();

-- Helpful indexes for the new admin page
CREATE INDEX IF NOT EXISTS idx_match_tool_leads_excluded_created
  ON public.match_tool_leads (excluded, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_tool_leads_pushed
  ON public.match_tool_leads (pushed_to_all_deals, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_tool_leads_stage
  ON public.match_tool_leads (submission_stage, created_at DESC);