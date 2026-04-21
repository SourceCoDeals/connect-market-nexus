-- ─────────────────────────────────────────────────────────────
-- 1) Validation function: returns reason string or NULL if clean
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.valuation_lead_quarantine_reason(
  _website text,
  _business_name text,
  _full_name text,
  _revenue numeric,
  _ebitda numeric
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  w text := lower(coalesce(trim(_website), ''));
  b text := lower(coalesce(trim(_business_name), ''));
  n text := lower(coalesce(trim(_full_name), ''));
BEGIN
  -- Strip protocol + www for matching
  w := regexp_replace(w, '^[a-z]{3,6}://', '');
  w := regexp_replace(w, '^www\.', '');

  -- ── WEBSITE checks ─────────────────────────────────────────
  IF w <> '' THEN
    -- Search engines / social / marketplaces posing as a website
    IF w ~ '^(google|facebook|fb|yelp|instagram|linkedin|youtube|youtu\.be|tiktok|amazon|bing|duckduckgo|yahoo|baidu|twitter|x\.com|pinterest|reddit|snapchat|whatsapp|telegram|wechat|wikipedia)\.' THEN
      RETURN 'invalid_website';
    END IF;
    IF w LIKE 'play.google.com%' OR w LIKE 'apps.apple.com%' OR w LIKE 'm.facebook.com%' THEN
      RETURN 'invalid_website';
    END IF;
    -- Whitespace is never valid in a domain
    IF w ~ '\s' THEN
      RETURN 'invalid_website';
    END IF;
    -- Must contain a dot
    IF position('.' in w) = 0 THEN
      RETURN 'invalid_website';
    END IF;
    -- Obvious placeholders
    IF w IN ('no.com', 'none.com', 'test.com', 'example.com', 'example.org', 'example.net', 'noemail.com', 'nowebsite.com', 'na.com') THEN
      RETURN 'invalid_website';
    END IF;
    IF w ~ '^(test|no|none|na|n/a|tbd|tba|blah|asdf|xxx)\.' THEN
      RETURN 'invalid_website';
    END IF;
    -- Comma instead of dot ("blahblah,com") and other malformed
    IF w ~ ',' THEN
      RETURN 'invalid_website';
    END IF;
  END IF;

  -- ── BUSINESS NAME / FULL NAME checks ──────────────────────
  IF b IN ('test', 'testing', 'theoretical', 'asdf', 'blah', 'blahblah', 'na', 'n/a', 'none', 'tbd', 'xxx') THEN
    RETURN 'invalid_business';
  END IF;
  IF b LIKE 'theoretical%' OR b LIKE 'test %' OR b LIKE '% test' OR b = 'my auto shop' OR b = 'my shop' OR b = 'mymechanic' OR b = 'kcc' THEN
    RETURN 'invalid_business';
  END IF;
  IF n IN ('test', 'testing', 'asdf', 'blah') THEN
    RETURN 'invalid_business';
  END IF;

  -- ── FINANCIAL sanity checks ────────────────────────────────
  -- Revenue impossibly large (> $100B)
  IF _revenue IS NOT NULL AND _revenue > 100000000000 THEN
    RETURN 'invalid_financials';
  END IF;
  -- Both revenue and ebitda exactly 0 (no real business signal)
  IF coalesce(_revenue, 0) = 0 AND coalesce(_ebitda, 0) = 0 THEN
    RETURN 'invalid_financials';
  END IF;
  -- Revenue = 1 / ebitda = 1 (joke values)
  IF _revenue IS NOT NULL AND _revenue > 0 AND _revenue < 100 THEN
    RETURN 'invalid_financials';
  END IF;

  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2) BEFORE INSERT/UPDATE trigger
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.quarantine_invalid_valuation_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reason text;
BEGIN
  -- Only auto-quarantine if not already explicitly excluded by an admin
  IF NEW.excluded IS DISTINCT FROM TRUE THEN
    reason := public.valuation_lead_quarantine_reason(
      NEW.website,
      NEW.business_name,
      NEW.full_name,
      NEW.revenue,
      NEW.ebitda
    );
    IF reason IS NOT NULL THEN
      NEW.excluded := TRUE;
      NEW.exclusion_reason := reason;
      NEW.status := COALESCE(NEW.status, 'excluded');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quarantine_invalid_valuation_lead ON public.valuation_leads;
CREATE TRIGGER trg_quarantine_invalid_valuation_lead
BEFORE INSERT OR UPDATE OF website, business_name, full_name, revenue, ebitda
ON public.valuation_leads
FOR EACH ROW
EXECUTE FUNCTION public.quarantine_invalid_valuation_lead();

-- ─────────────────────────────────────────────────────────────
-- 3) Backfill: flip existing junk to excluded
-- ─────────────────────────────────────────────────────────────
UPDATE public.valuation_leads vl
SET
  excluded = TRUE,
  exclusion_reason = r.reason,
  status = COALESCE(vl.status, 'excluded'),
  updated_at = now()
FROM (
  SELECT id, public.valuation_lead_quarantine_reason(website, business_name, full_name, revenue, ebitda) AS reason
  FROM public.valuation_leads
  WHERE excluded IS DISTINCT FROM TRUE
) r
WHERE vl.id = r.id
  AND r.reason IS NOT NULL;
