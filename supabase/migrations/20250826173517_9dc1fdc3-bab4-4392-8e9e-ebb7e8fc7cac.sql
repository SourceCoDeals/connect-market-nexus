-- Fix Security Issues: Replace insecure view with secure function and RLS

-- 1. Drop the insecure public view that exposes personal data
DROP VIEW IF EXISTS public.profiles_with_history;

-- 2. Create secure function that respects RLS and admin access only
CREATE OR REPLACE FUNCTION public.get_profiles_with_history()
RETURNS TABLE (
    id uuid,
    email text,
    buyer_type text,
    business_categories_current jsonb,
    business_categories_dedup jsonb,
    target_locations_current jsonb,
    target_locations_dedup jsonb,
    raw_business_categories jsonb,
    raw_target_locations jsonb,
    snapshot_type text,
    snapshot_created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Only allow admins to access this data
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    RETURN QUERY
    SELECT p.id,
        p.email,
        p.buyer_type,
        p.business_categories AS business_categories_current,
        CASE
            WHEN ((p.business_categories IS NULL) OR (jsonb_typeof(p.business_categories) <> 'array'::text)) THEN '[]'::jsonb
            ELSE ( SELECT COALESCE(jsonb_agg(DISTINCT cat.value ORDER BY cat.value), '[]'::jsonb) AS "coalesce"
               FROM jsonb_array_elements_text(p.business_categories) cat(value))
        END AS business_categories_dedup,
        p.target_locations AS target_locations_current,
        CASE
            WHEN (p.target_locations IS NULL) THEN '[]'::jsonb
            WHEN (jsonb_typeof(p.target_locations) = 'array'::text) THEN ( SELECT COALESCE(jsonb_agg(DISTINCT loc.value ORDER BY loc.value), '[]'::jsonb) AS "coalesce"
               FROM jsonb_array_elements_text(p.target_locations) loc(value))
            WHEN (jsonb_typeof(p.target_locations) = 'string'::text) THEN jsonb_build_array(p.target_locations)
            ELSE '[]'::jsonb
        END AS target_locations_dedup,
        s.raw_business_categories,
        s.raw_target_locations,
        s.snapshot_type,
        s.created_at AS snapshot_created_at
    FROM (profiles p
         LEFT JOIN LATERAL ( SELECT s_1.raw_business_categories,
                s_1.raw_target_locations,
                s_1.snapshot_type,
                s_1.created_at
               FROM profile_data_snapshots s_1
              WHERE (s_1.profile_id = p.id)
              ORDER BY
                    CASE s_1.snapshot_type
                        WHEN 'raw_signup'::text THEN 0
                        WHEN 'audit_old'::text THEN 1
                        ELSE 2
                    END, s_1.created_at
             LIMIT 1) s ON (true));
END;
$$;