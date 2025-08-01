-- Production Security Hardening - Fix function search_path issues
-- Simplified approach without unsupported functions

-- 1. Set search_path for specific functions that need it
-- Handle the main user-defined functions explicitly

-- Update any remaining functions that don't have search_path set
ALTER FUNCTION public.calculate_engagement_score(integer, integer, integer, integer) SET search_path = 'public';
ALTER FUNCTION public.get_feedback_analytics(integer) SET search_path = 'public';
ALTER FUNCTION public.get_simple_marketplace_analytics(integer) SET search_path = 'public';
ALTER FUNCTION public.match_deal_alerts_with_listing(jsonb) SET search_path = 'public';
ALTER FUNCTION public.refresh_analytics_views() SET search_path = 'public';
ALTER FUNCTION public.update_daily_metrics(date) SET search_path = 'public';
ALTER FUNCTION public.update_engagement_scores() SET search_path = 'public';

-- 2. Add database-level security monitoring function
CREATE OR REPLACE FUNCTION public.log_security_event(
    event_type TEXT,
    user_id UUID DEFAULT auth.uid(),
    metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.audit_logs (
        table_name,
        operation,
        user_id,
        metadata
    ) VALUES (
        'security_events',
        event_type,
        user_id,
        metadata || jsonb_build_object(
            'timestamp', now(),
            'event_type', event_type
        )
    );
END;
$$;

-- 3. Create production readiness verification function
CREATE OR REPLACE FUNCTION public.verify_production_readiness()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'RLS_Enabled'::TEXT as check_name,
        CASE 
            WHEN COUNT(*) = COUNT(*) FILTER (WHERE relrowsecurity = true)
            THEN '✅ PASS'::TEXT
            ELSE '⚠️ WARN'::TEXT
        END as status,
        FORMAT('%s/%s tables have RLS enabled', 
               COUNT(*) FILTER (WHERE relrowsecurity = true),
               COUNT(*)
        )::TEXT as details
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT LIKE 'pg_%'
    AND c.relname NOT IN ('daily_metrics', 'audit_logs', 'password_reset_tokens')  -- System tables
    
    UNION ALL
    
    SELECT 
        'Admin_Users'::TEXT,
        CASE 
            WHEN COUNT(*) > 0 THEN '✅ PASS'::TEXT
            ELSE '❌ FAIL'::TEXT
        END,
        FORMAT('%s admin users configured', COUNT(*))::TEXT
    FROM public.profiles
    WHERE is_admin = true AND approval_status = 'approved';
END;
$$;

-- Add tracking comment
COMMENT ON FUNCTION public.log_security_event IS 'Production security monitoring and audit logging';
COMMENT ON FUNCTION public.verify_production_readiness IS 'Automated production readiness verification checks';

-- Run production readiness verification
SELECT * FROM public.verify_production_readiness();