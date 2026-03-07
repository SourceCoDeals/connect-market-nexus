-- Drop confirmed dead columns from listings table.
--
-- Evidence for each column being dead:
--
-- linkedin_headquarters: Written by LinkedIn scraper (Apify), but NEVER read
--   anywhere in frontend or edge function code. Zero display, zero logic references.
--
-- status_label: Only appeared in auto-generated types. Zero reads/writes in
--   any component, hook, or edge function. (status_tag is the active UI label field.)
--
-- NOTE: financial_notes was originally included here but is actively used by
--   extract-deal-transcript, extract-transcript, analyze-deal-notes,
--   calculate-deal-quality, and _shared/deal-extraction. Removed from DROP.

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS linkedin_headquarters,
  DROP COLUMN IF EXISTS status_label;
