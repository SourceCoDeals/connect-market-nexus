-- PHASE 3: Fix functions with search_path - use CASCADE for dependencies

-- Drop and recreate extract_domain function (has index dependency)
DROP FUNCTION IF EXISTS public.extract_domain(text) CASCADE;
CREATE FUNCTION public.extract_domain(email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT lower(split_part(email, '@', 2));
$$;

-- Recreate the index that depended on extract_domain
CREATE INDEX IF NOT EXISTS idx_inbound_leads_email_domain ON inbound_leads (extract_domain(email));

-- Drop and recreate normalize_company_name function
DROP FUNCTION IF EXISTS public.normalize_company_name(text) CASCADE;
CREATE FUNCTION public.normalize_company_name(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE  
SET search_path TO 'public'
AS $$
  SELECT lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'));
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Drop and recreate increment function
DROP FUNCTION IF EXISTS public.increment(integer) CASCADE;
CREATE FUNCTION public.increment(x integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT x + 1;
$$;

-- Fix update_daily_metrics function
CREATE OR REPLACE FUNCTION public.update_daily_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
BEGIN
  INSERT INTO daily_metrics (date, total_users, new_signups, new_listings, connection_requests, successful_connections)
  SELECT
    today_date,
    (SELECT count(*) FROM profiles),
    (SELECT count(*) FROM profiles WHERE DATE(created_at) = today_date),
    (SELECT count(*) FROM listings WHERE DATE(created_at) = today_date),
    (SELECT count(*) FROM connection_requests WHERE DATE(created_at) = today_date),
    (SELECT count(*) FROM connection_requests WHERE status = 'approved' AND DATE(updated_at) = today_date)
  ON CONFLICT (date) DO UPDATE SET
    total_users = EXCLUDED.total_users,
    new_signups = EXCLUDED.new_signups,
    new_listings = EXCLUDED.new_listings,
    connection_requests = EXCLUDED.connection_requests,
    successful_connections = EXCLUDED.successful_connections,
    updated_at = now();
END;
$$;

-- Drop and recreate get_engagement_analytics function
DROP FUNCTION IF EXISTS public.get_engagement_analytics(text) CASCADE;
CREATE FUNCTION public.get_engagement_analytics(time_range text DEFAULT '30d')
RETURNS TABLE(
  total_users bigint,
  active_users bigint,
  avg_engagement_score numeric,
  top_engaged_users json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  date_filter timestamp;
BEGIN
  date_filter := CASE time_range
    WHEN '7d' THEN now() - interval '7 days'
    WHEN '30d' THEN now() - interval '30 days'
    WHEN '90d' THEN now() - interval '90 days'
    ELSE now() - interval '30 days'
  END;

  RETURN QUERY
  SELECT
    (SELECT count(*)::bigint FROM profiles) as total_users,
    (SELECT count(*)::bigint FROM engagement_scores WHERE last_active > date_filter) as active_users,
    (SELECT COALESCE(avg(score), 0)::numeric FROM engagement_scores) as avg_engagement_score,
    (SELECT json_agg(row_to_json(t))
     FROM (
       SELECT es.user_id, es.score, p.email, p.first_name, p.last_name
       FROM engagement_scores es
       JOIN profiles p ON es.user_id = p.id
       ORDER BY es.score DESC
       LIMIT 10
     ) t
    ) as top_engaged_users;
END;
$$;

-- Drop and recreate calculate_buyer_priority_score function
DROP FUNCTION IF EXISTS public.calculate_buyer_priority_score(text, text, text, text[], text[], text, text, boolean) CASCADE;
CREATE FUNCTION public.calculate_buyer_priority_score(
  p_buyer_type text,
  p_company_name text,
  p_annual_revenue text,
  p_business_categories text[],
  p_target_locations text[],
  p_capital_available text,
  p_acquisition_timeline text,
  p_is_registered_user boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  score integer := 0;
BEGIN
  IF p_buyer_type = 'PE Firm' THEN score := score + 30;
  ELSIF p_buyer_type = 'Family Office' THEN score := score + 25;
  ELSIF p_buyer_type = 'Strategic Acquirer' THEN score := score + 20;
  ELSIF p_buyer_type = 'Search Fund' THEN score := score + 15;
  ELSIF p_buyer_type = 'Independent Sponsor' THEN score := score + 10;
  ELSE score := score + 5;
  END IF;

  IF p_capital_available = '$50M+' THEN score := score + 25;
  ELSIF p_capital_available = '$20M-$50M' THEN score := score + 20;
  ELSIF p_capital_available = '$10M-$20M' THEN score := score + 15;
  ELSIF p_capital_available = '$5M-$10M' THEN score := score + 10;
  ELSE score := score + 5;
  END IF;

  IF p_acquisition_timeline = 'Immediate (0-3 months)' THEN score := score + 20;
  ELSIF p_acquisition_timeline = 'Short-term (3-6 months)' THEN score := score + 15;
  ELSIF p_acquisition_timeline = 'Medium-term (6-12 months)' THEN score := score + 10;
  ELSE score := score + 5;
  END IF;

  IF p_is_registered_user THEN score := score + 10; END IF;
  IF p_company_name IS NOT NULL AND p_company_name != '' THEN score := score + 5; END IF;
  IF p_business_categories IS NOT NULL AND array_length(p_business_categories, 1) > 0 THEN score := score + 5; END IF;
  IF p_target_locations IS NOT NULL AND array_length(p_target_locations, 1) > 0 THEN score := score + 5; END IF;

  RETURN LEAST(score, 100);
END;
$$;

-- Drop and recreate get_connection_request_analytics function
DROP FUNCTION IF EXISTS public.get_connection_request_analytics(text) CASCADE;
CREATE FUNCTION public.get_connection_request_analytics(time_range text DEFAULT '30d')
RETURNS TABLE(
  total_requests bigint,
  pending_requests bigint,
  approved_requests bigint,
  rejected_requests bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  date_filter timestamp;
BEGIN
  date_filter := CASE time_range
    WHEN '7d' THEN now() - interval '7 days'
    WHEN '30d' THEN now() - interval '30 days'
    WHEN '90d' THEN now() - interval '90 days'
    ELSE now() - interval '30 days'
  END;

  RETURN QUERY
  SELECT
    count(*)::bigint as total_requests,
    count(*) FILTER (WHERE status = 'pending')::bigint as pending_requests,
    count(*) FILTER (WHERE status = 'approved')::bigint as approved_requests,
    count(*) FILTER (WHERE status = 'rejected')::bigint as rejected_requests,
    CASE 
      WHEN count(*) > 0 THEN 
        (count(*) FILTER (WHERE status = 'approved')::numeric / count(*)::numeric * 100)
      ELSE 0
    END as conversion_rate
  FROM connection_requests
  WHERE created_at > date_filter;
END;
$$;

-- PHASE 4: Restrict Firm Agreements Access
DROP POLICY IF EXISTS "Approved users can view firm agreements" ON firm_agreements;
DROP POLICY IF EXISTS "Admins can view all firm agreements" ON firm_agreements;
CREATE POLICY "Admins can view all firm agreements" ON firm_agreements
  FOR SELECT
  USING (is_admin(auth.uid()));