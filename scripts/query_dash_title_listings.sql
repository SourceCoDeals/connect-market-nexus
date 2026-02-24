-- ============================================================================
-- Investigate listings with title = '-'
-- Run this in the Supabase SQL editor (requires admin access)
-- ============================================================================

-- 1. How many, and where do they come from?
SELECT
  source,
  COUNT(*)           AS count,
  MIN(created_at)    AS earliest,
  MAX(created_at)    AS latest
FROM public.listings
WHERE TRIM(title) = '-'
   OR TRIM(title) = ''
GROUP BY source
ORDER BY count DESC;

-- 2. Sample 20 to understand what data they DO have
SELECT
  id,
  title,
  internal_company_name,
  industry,
  location,
  revenue,
  ebitda,
  source,
  website,
  created_at
FROM public.listings
WHERE TRIM(title) = '-'
   OR TRIM(title) = ''
ORDER BY created_at DESC
LIMIT 20;

-- 3. Do any have usable internal_company_name? (could be fixed by renaming title)
SELECT
  COUNT(*) FILTER (WHERE internal_company_name IS NOT NULL AND TRIM(internal_company_name) NOT IN ('', '-')) AS has_company_name,
  COUNT(*) FILTER (WHERE internal_company_name IS NULL OR TRIM(internal_company_name) IN ('', '-'))           AS no_company_name,
  COUNT(*) FILTER (WHERE website IS NOT NULL)                                                                 AS has_website,
  COUNT(*) FILTER (WHERE ebitda IS NOT NULL)                                                                  AS has_ebitda,
  COUNT(*) FILTER (WHERE industry IS NOT NULL)                                                                AS has_industry
FROM public.listings
WHERE TRIM(title) = '-'
   OR TRIM(title) = '';

-- 4. Are any linked to active deals or scores? (would block safe deletion)
SELECT
  l.id,
  l.title,
  l.internal_company_name,
  COUNT(DISTINCT rs.id)  AS score_count,
  COUNT(DISTINCT d.id)   AS deal_count
FROM public.listings l
LEFT JOIN public.remarketing_scores rs ON rs.listing_id = l.id
LEFT JOIN public.deals               d  ON d.listing_id  = l.id
WHERE TRIM(l.title) = '-'
   OR TRIM(l.title) = ''
GROUP BY l.id, l.title, l.internal_company_name
HAVING COUNT(DISTINCT rs.id) > 0 OR COUNT(DISTINCT d.id) > 0
ORDER BY score_count DESC, deal_count DESC;

-- 5. Full breakdown — are they safe to archive/delete?
SELECT
  CASE
    WHEN (internal_company_name IS NOT NULL AND TRIM(internal_company_name) NOT IN ('', '-'))
      THEN 'fixable — has company name'
    WHEN website IS NOT NULL
      THEN 'potentially fixable — has website'
    ELSE 'empty shell — safe to archive'
  END AS disposition,
  COUNT(*) AS count
FROM public.listings
WHERE TRIM(title) = '-'
   OR TRIM(title) = ''
GROUP BY disposition
ORDER BY count DESC;
