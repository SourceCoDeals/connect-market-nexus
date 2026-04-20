-- Extend auto-quarantine trigger with noise-domain list
CREATE OR REPLACE FUNCTION public.match_tool_leads_auto_quarantine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_website_lower text := lower(coalesce(NEW.website, ''));
  v_name_lower    text := lower(coalesce(NEW.full_name, ''));
  v_business_lower text := lower(coalesce(NEW.business_name, ''));
  v_email_lower   text := lower(coalesce(NEW.email, ''));
  v_clean_domain  text;
  v_noise_domains text[] := ARRAY[
    -- File sharing / data rooms
    'docsend.com','dropbox.com','box.com','wetransfer.com','sharepoint.com',
    'drive.google.com','onedrive.live.com','icloud.com','mega.nz',
    -- Scheduling / forms / docs
    'calendly.com','typeform.com','jotform.com','google.com','docs.google.com',
    'forms.gle','notion.so','notion.site','airtable.com','coda.io',
    -- Portfolio / no-code site builders
    'wix.com','squarespace.com','weebly.com','wordpress.com','framer.com',
    'webflow.io','vercel.app','netlify.app','github.io','lovable.app',
    'lovable.dev','bubble.io','carrd.co',
    -- Social / professional
    'linkedin.com','facebook.com','instagram.com','twitter.com','x.com',
    'youtube.com','tiktok.com','reddit.com','medium.com','substack.com',
    'pinterest.com','threads.net',
    -- Marketplaces / generic platforms
    'amazon.com','ebay.com','etsy.com','shopify.com','bizbuysell.com',
    'crunchbase.com','glassdoor.com','indeed.com','yelp.com'
  ];
BEGIN
  -- Skip if already explicitly excluded
  IF NEW.excluded IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Strip protocol / www / path for noise comparison
  v_clean_domain := regexp_replace(v_website_lower, '^https?://', '');
  v_clean_domain := regexp_replace(v_clean_domain, '^www\.', '');
  v_clean_domain := split_part(v_clean_domain, '/', 1);
  v_clean_domain := split_part(v_clean_domain, '?', 1);
  v_clean_domain := split_part(v_clean_domain, '#', 1);

  -- Junk websites (test/example)
  IF v_website_lower IN ('test.com', 'test.net', 'example.com', 'example.org', 'test.test', 'a.com', 'aa.com')
     OR v_website_lower LIKE 'test.%'
     OR v_website_lower LIKE '%lovabletest%'
     OR v_website_lower LIKE '%e2etest%'
  THEN
    NEW.excluded := true;
    NEW.exclusion_reason := 'invalid_website';
    RETURN NEW;
  END IF;

  -- Noise domain (user typed the platform they were on, not their business)
  IF v_clean_domain = ANY(v_noise_domains) THEN
    NEW.excluded := true;
    NEW.exclusion_reason := 'platform_not_business';
    RETURN NEW;
  END IF;

  -- Invalid: no TLD or too short after cleanup
  IF v_clean_domain !~ '\.' OR length(v_clean_domain) < 5 THEN
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
$function$;

-- Backfill: re-evaluate existing rows by triggering an UPDATE that flips through the trigger.
-- We touch updated_at to force the BEFORE UPDATE trigger to re-run.
UPDATE public.match_tool_leads
SET updated_at = now()
WHERE excluded IS NOT TRUE;

-- Backfill location from enrichment_data.geography for rows missing location
UPDATE public.match_tool_leads
SET location = enrichment_data->>'geography',
    last_enriched_at = COALESCE(last_enriched_at, updated_at)
WHERE location IS NULL
  AND enrichment_data ? 'geography'
  AND enrichment_data->>'geography' IS NOT NULL
  AND enrichment_data->>'geography' NOT IN ('Not specified','Global','Unknown','','Not sure','International');