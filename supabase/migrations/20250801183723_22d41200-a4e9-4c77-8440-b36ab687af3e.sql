-- Production Security Hardening - Complete Supabase Configuration
-- Fix remaining security warnings for production deployment

-- 1. Fix any remaining function search_path issues
-- Ensure all custom functions have proper search_path set
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Loop through all functions in public schema and set search_path if not already set
    FOR func_record IN 
        SELECT 
            p.proname as function_name,
            pg_get_function_arguments(p.oid) as arguments,
            p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname NOT LIKE 'pg_%'
        AND NOT EXISTS (
            SELECT 1 FROM pg_proc_config(p.oid) 
            WHERE setting LIKE 'search_path%'
        )
    LOOP
        -- Set search_path for functions that don't have it configured
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = ''public''', 
                          func_record.function_name, 
                          func_record.arguments);
            RAISE NOTICE 'Set search_path for function: %', func_record.function_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not set search_path for function %: %', func_record.function_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 2. Configure secure OTP settings
-- Note: This is handled in Supabase Dashboard under Auth > Settings
-- Recommended: Set OTP expiry to 600 seconds (10 minutes) instead of 3600 seconds (1 hour)

-- 3. Password security enhancements
-- Note: Leaked password protection is configured in Supabase Dashboard under Auth > Settings

-- 4. Add database-level security monitoring
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
            'ip_address', current_setting('request.headers', true)::jsonb->>'cf-connecting-ip'
        )
    );
END;
$$;

-- 5. Create security monitoring views
CREATE OR REPLACE VIEW public.security_summary AS
SELECT 
    'function_security' as check_type,
    COUNT(*) as total_functions,
    COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM pg_proc_config(p.oid) 
        WHERE setting LIKE 'search_path%'
    )) as secure_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname NOT LIKE 'pg_%'

UNION ALL

SELECT 
    'rls_enabled' as check_type,
    COUNT(*) as total_tables,
    COUNT(*) FILTER (WHERE relrowsecurity = true) as rls_enabled_tables
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND c.relkind = 'r'  -- Only regular tables
AND c.relname NOT LIKE 'pg_%';

-- Add comment for tracking
COMMENT ON FUNCTION public.log_security_event IS 'Production security monitoring - logs security events for audit trail';

-- Verify security configuration
SELECT 
    check_type,
    total_functions as total,
    secure_functions as secure,
    CASE 
        WHEN total_functions = secure_functions THEN '✅ All Secure'
        ELSE '⚠️ Needs Review'
    END as status
FROM public.security_summary
WHERE check_type = 'function_security';