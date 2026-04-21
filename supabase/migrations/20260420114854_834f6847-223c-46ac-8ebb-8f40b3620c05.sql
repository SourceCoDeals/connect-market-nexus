-- Make the auto-quarantine trigger fire on UPDATE too, so future edits get re-validated
DROP TRIGGER IF EXISTS trg_match_tool_leads_auto_quarantine ON public.match_tool_leads;
CREATE TRIGGER trg_match_tool_leads_auto_quarantine
  BEFORE INSERT OR UPDATE ON public.match_tool_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.match_tool_leads_auto_quarantine();

-- Direct backfill for existing noise-domain rows
WITH noise(domain) AS (
  SELECT unnest(ARRAY[
    'docsend.com','dropbox.com','box.com','wetransfer.com','sharepoint.com',
    'drive.google.com','onedrive.live.com','icloud.com','mega.nz',
    'calendly.com','typeform.com','jotform.com','google.com','docs.google.com',
    'forms.gle','notion.so','notion.site','airtable.com','coda.io',
    'wix.com','squarespace.com','weebly.com','wordpress.com','framer.com',
    'webflow.io','vercel.app','netlify.app','github.io','lovable.app',
    'lovable.dev','bubble.io','carrd.co',
    'linkedin.com','facebook.com','instagram.com','twitter.com','x.com',
    'youtube.com','tiktok.com','reddit.com','medium.com','substack.com',
    'pinterest.com','threads.net',
    'amazon.com','ebay.com','etsy.com','shopify.com','bizbuysell.com',
    'crunchbase.com','glassdoor.com','indeed.com','yelp.com'
  ])
)
UPDATE public.match_tool_leads m
SET excluded = true,
    exclusion_reason = 'platform_not_business'
WHERE excluded IS NOT TRUE
  AND EXISTS (
    SELECT 1 FROM noise n
    WHERE split_part(
            split_part(
              regexp_replace(regexp_replace(lower(m.website), '^https?://', ''), '^www\.', ''),
              '/', 1),
            '?', 1) = n.domain
  );

-- Also flag clearly invalid websites (no TLD or under 5 chars after cleanup)
UPDATE public.match_tool_leads
SET excluded = true,
    exclusion_reason = 'invalid_website'
WHERE excluded IS NOT TRUE
  AND (
    length(split_part(regexp_replace(regexp_replace(lower(website), '^https?://', ''), '^www\.', ''), '/', 1)) < 5
    OR split_part(regexp_replace(regexp_replace(lower(website), '^https?://', ''), '^www\.', ''), '/', 1) !~ '\.'
  );