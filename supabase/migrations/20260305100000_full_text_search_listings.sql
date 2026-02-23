-- Full-Text Search for listings table
--
-- Replaces slow ILIKE queries with PostgreSQL native tsvector/tsquery full-text search.
-- Uses english dictionary for stemming (e.g. "manufacturing" matches "manufacture").
-- Weighted ranking: title (A) > category (B) > location (B) > description (C) > tags (D)
--
-- NOTE: to_tsvector() is STABLE not IMMUTABLE, so we cannot use GENERATED ALWAYS AS.
-- Instead we use a plain column + trigger to keep it in sync.

-- 1. Add the tsvector column (plain, not generated)
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS fts tsvector;

-- 2. Create the trigger function that builds the weighted tsvector
CREATE OR REPLACE FUNCTION public.listings_fts_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.location, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'D');
  RETURN NEW;
END;
$$;

-- 3. Attach trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_listings_fts ON public.listings;
CREATE TRIGGER trg_listings_fts
  BEFORE INSERT OR UPDATE OF title, category, location, description, tags
  ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_fts_trigger();

-- 4. Backfill existing rows so they have fts populated
UPDATE public.listings
SET fts =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(location, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'D')
WHERE fts IS NULL;

-- 5. Create GIN index for fast full-text lookups
CREATE INDEX IF NOT EXISTS idx_listings_fts ON public.listings USING gin(fts);

-- 6. Create an RPC function for ranked full-text search with filters
--    Returns listings ordered by relevance score, with optional filtering.
CREATE OR REPLACE FUNCTION public.search_listings(
  search_query text,
  filter_status text DEFAULT 'active',
  filter_category text DEFAULT NULL,
  filter_location text DEFAULT NULL,
  filter_revenue_min numeric DEFAULT NULL,
  filter_revenue_max numeric DEFAULT NULL,
  filter_ebitda_min numeric DEFAULT NULL,
  filter_ebitda_max numeric DEFAULT NULL,
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  description_html text,
  hero_description text,
  category text,
  categories text[],
  acquisition_type text,
  location text,
  revenue numeric,
  ebitda numeric,
  tags text[],
  image_url text,
  status text,
  status_tag text,
  visible_to_buyer_types text[],
  created_at timestamptz,
  updated_at timestamptz,
  full_time_employees int,
  part_time_employees int,
  custom_metric_label text,
  custom_metric_value text,
  custom_metric_subtitle text,
  metric_3_type text,
  metric_3_custom_label text,
  metric_3_custom_value text,
  metric_3_custom_subtitle text,
  metric_4_type text,
  metric_4_custom_label text,
  metric_4_custom_value text,
  metric_4_custom_subtitle text,
  revenue_metric_subtitle text,
  ebitda_metric_subtitle text,
  owner_notes text,
  rank real,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tsq tsquery;
  total bigint;
BEGIN
  -- Build the tsquery from user input
  -- Use websearch_to_tsquery for natural language queries (supports "quoted phrases", OR, -)
  tsq := websearch_to_tsquery('english', search_query);

  -- Count total matching results (for pagination)
  SELECT count(*) INTO total
  FROM public.listings l
  WHERE l.fts @@ tsq
    AND l.status = filter_status
    AND l.deleted_at IS NULL
    AND l.is_internal_deal = false
    AND (filter_category IS NULL OR l.category = filter_category OR l.categories @> ARRAY[filter_category])
    AND (filter_location IS NULL OR l.location = filter_location)
    AND (filter_revenue_min IS NULL OR l.revenue >= filter_revenue_min)
    AND (filter_revenue_max IS NULL OR l.revenue <= filter_revenue_max)
    AND (filter_ebitda_min IS NULL OR l.ebitda >= filter_ebitda_min)
    AND (filter_ebitda_max IS NULL OR l.ebitda <= filter_ebitda_max);

  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.description,
    l.description_html,
    l.hero_description,
    l.category,
    l.categories,
    l.acquisition_type,
    l.location,
    l.revenue,
    l.ebitda,
    l.tags,
    l.image_url,
    l.status,
    l.status_tag,
    l.visible_to_buyer_types,
    l.created_at,
    l.updated_at,
    l.full_time_employees,
    l.part_time_employees,
    l.custom_metric_label,
    l.custom_metric_value,
    l.custom_metric_subtitle,
    l.metric_3_type,
    l.metric_3_custom_label,
    l.metric_3_custom_value,
    l.metric_3_custom_subtitle,
    l.metric_4_type,
    l.metric_4_custom_label,
    l.metric_4_custom_value,
    l.metric_4_custom_subtitle,
    l.revenue_metric_subtitle,
    l.ebitda_metric_subtitle,
    l.owner_notes,
    ts_rank_cd(l.fts, tsq) AS rank,
    total AS total_count
  FROM public.listings l
  WHERE l.fts @@ tsq
    AND l.status = filter_status
    AND l.deleted_at IS NULL
    AND l.is_internal_deal = false
    AND (filter_category IS NULL OR l.category = filter_category OR l.categories @> ARRAY[filter_category])
    AND (filter_location IS NULL OR l.location = filter_location)
    AND (filter_revenue_min IS NULL OR l.revenue >= filter_revenue_min)
    AND (filter_revenue_max IS NULL OR l.revenue <= filter_revenue_max)
    AND (filter_ebitda_min IS NULL OR l.ebitda >= filter_ebitda_min)
    AND (filter_ebitda_max IS NULL OR l.ebitda <= filter_ebitda_max)
  ORDER BY ts_rank_cd(l.fts, tsq) DESC, l.created_at DESC
  OFFSET page_offset
  LIMIT page_limit;
END;
$$;

-- 7. Grant execute to authenticated users (Supabase RLS still applies)
GRANT EXECUTE ON FUNCTION public.search_listings TO authenticated;

COMMENT ON COLUMN public.listings.fts IS 'Trigger-maintained tsvector for full-text search. Weighted: title(A) > category/location(B) > description(C) > tags(D)';
