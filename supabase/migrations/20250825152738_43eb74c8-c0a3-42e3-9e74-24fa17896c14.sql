
-- 1) Snapshot table for preserving raw/historical profile data
CREATE TABLE IF NOT EXISTS public.profile_data_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL DEFAULT 'raw_signup', -- raw_signup | audit_old | import | manual
  raw_business_categories jsonb,
  raw_target_locations jsonb,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_data_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS: admins can view; system can insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profile_data_snapshots' AND policyname = 'Admins can view snapshots'
  ) THEN
    CREATE POLICY "Admins can view snapshots"
      ON public.profile_data_snapshots
      FOR SELECT
      USING (is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profile_data_snapshots' AND policyname = 'System can insert snapshots'
  ) THEN
    CREATE POLICY "System can insert snapshots"
      ON public.profile_data_snapshots
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- 2) Trigger to capture raw signup payload on profile creation
CREATE OR REPLACE FUNCTION public.capture_signup_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  raw jsonb;
  raw_categories jsonb;
  raw_locations jsonb;
BEGIN
  -- Pull raw signup metadata from auth.users
  SELECT raw_user_meta_data INTO raw FROM auth.users WHERE id = NEW.id;

  IF raw IS NOT NULL THEN
    -- Try common keys for categories and locations
    IF raw ? 'business_categories' THEN
      raw_categories := raw->'business_categories';
    ELSIF raw ? 'businessCategories' THEN
      raw_categories := raw->'businessCategories';
    END IF;

    IF raw ? 'target_locations' THEN
      raw_locations := raw->'target_locations';
    ELSIF raw ? 'targetLocations' THEN
      raw_locations := raw->'targetLocations';
    END IF;

    INSERT INTO public.profile_data_snapshots (
      profile_id, snapshot_type, raw_business_categories, raw_target_locations, raw_payload
    ) VALUES (
      NEW.id, 'raw_signup', raw_categories, raw_locations, raw
    );
  END IF;

  RETURN NEW;
END
$func$;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgrelid = 'public.profiles'::regclass 
      AND tgname = 'on_profile_created_capture_snapshot'
  ) THEN
    CREATE TRIGGER on_profile_created_capture_snapshot
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.capture_signup_snapshot();
  END IF;
END $$;

-- 3a) Backfill snapshots from earliest audit_logs.old_data (best-effort)
-- Only insert one snapshot per profile if none exists yet
WITH earliest AS (
  SELECT DISTINCT ON ((COALESCE(old_data->>'id', new_data->>'id'))::uuid)
         (COALESCE(old_data->>'id', new_data->>'id'))::uuid AS profile_id,
         old_data,
         new_data,
         timestamp
  FROM public.audit_logs
  WHERE table_name = 'profiles'
    AND (old_data ? 'business_categories' OR old_data ? 'target_locations')
  ORDER BY (COALESCE(old_data->>'id', new_data->>'id'))::uuid, timestamp ASC
)
INSERT INTO public.profile_data_snapshots (profile_id, snapshot_type, raw_business_categories, raw_target_locations, raw_payload, created_at)
SELECT e.profile_id,
       'audit_old',
       e.old_data->'business_categories',
       e.old_data->'target_locations',
       e.old_data,
       e.timestamp
FROM earliest e
WHERE NOT EXISTS (
  SELECT 1 FROM public.profile_data_snapshots s WHERE s.profile_id = e.profile_id
);

-- 3b) Backfill snapshots from auth.users for profiles with no snapshot yet
INSERT INTO public.profile_data_snapshots (profile_id, snapshot_type, raw_business_categories, raw_target_locations, raw_payload)
SELECT p.id,
       'raw_signup',
       CASE 
         WHEN jsonb_typeof(u.raw_user_meta_data->'business_categories') = 'array' 
           THEN u.raw_user_meta_data->'business_categories'
         WHEN jsonb_typeof(u.raw_user_meta_data->'businessCategories') = 'array' 
           THEN u.raw_user_meta_data->'businessCategories'
         ELSE NULL
       END,
       CASE 
         WHEN jsonb_typeof(u.raw_user_meta_data->'target_locations') = 'array' 
           THEN u.raw_user_meta_data->'target_locations'
         WHEN jsonb_typeof(u.raw_user_meta_data->'targetLocations') = 'array' 
           THEN u.raw_user_meta_data->'targetLocations'
         ELSE NULL
       END,
       u.raw_user_meta_data
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.profile_data_snapshots s WHERE s.profile_id = p.id
);

-- 4) Normalize today’s data

-- 4a) Ensure target_locations are arrays (convert any JSON string into single-element array)
UPDATE public.profiles
SET target_locations = jsonb_build_array(target_locations)
WHERE target_locations IS NOT NULL
  AND jsonb_typeof(target_locations) = 'string';

-- 4b) Deduplicate business_categories arrays
UPDATE public.profiles
SET business_categories = (
  SELECT COALESCE(jsonb_agg(DISTINCT elem ORDER BY elem), '[]'::jsonb)
  FROM jsonb_array_elements_text(business_categories) AS elem
)
WHERE business_categories IS NOT NULL
  AND jsonb_typeof(business_categories) = 'array'
  AND jsonb_array_length(business_categories) > 0;

-- 4c) Deduplicate target_locations arrays
UPDATE public.profiles
SET target_locations = (
  SELECT COALESCE(jsonb_agg(DISTINCT elem ORDER BY elem), '[]'::jsonb)
  FROM jsonb_array_elements_text(target_locations) AS elem
)
WHERE target_locations IS NOT NULL
  AND jsonb_typeof(target_locations) = 'array'
  AND jsonb_array_length(target_locations) > 0;

-- 5) Create a helper view for admins to compare current vs historical/raw snapshot
CREATE OR REPLACE VIEW public.profiles_with_history AS
SELECT 
  p.id,
  p.email,
  p.buyer_type,
  p.business_categories AS business_categories_current,
  CASE 
    WHEN p.business_categories IS NULL OR jsonb_typeof(p.business_categories) <> 'array' THEN '[]'::jsonb
    ELSE (SELECT COALESCE(jsonb_agg(DISTINCT cat ORDER BY cat), '[]'::jsonb)
          FROM jsonb_array_elements_text(p.business_categories) cat)
  END AS business_categories_dedup,
  p.target_locations AS target_locations_current,
  CASE 
    WHEN p.target_locations IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(p.target_locations) = 'array' THEN (
      SELECT COALESCE(jsonb_agg(DISTINCT loc ORDER BY loc), '[]'::jsonb)
      FROM jsonb_array_elements_text(p.target_locations) loc
    )
    WHEN jsonb_typeof(p.target_locations) = 'string' THEN jsonb_build_array(p.target_locations)
    ELSE '[]'::jsonb
  END AS target_locations_dedup,
  s.raw_business_categories,
  s.raw_target_locations,
  s.snapshot_type,
  s.created_at AS snapshot_created_at
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT raw_business_categories, raw_target_locations, snapshot_type, created_at
  FROM public.profile_data_snapshots s
  WHERE s.profile_id = p.id
  ORDER BY 
    CASE s.snapshot_type 
      WHEN 'raw_signup' THEN 0
      WHEN 'audit_old' THEN 1
      ELSE 2
    END,
    s.created_at ASC
  LIMIT 1
) s ON TRUE;
