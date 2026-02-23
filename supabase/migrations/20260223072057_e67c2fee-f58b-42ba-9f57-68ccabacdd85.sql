
-- Fix SECURITY DEFINER functions missing search_path

-- 1. fn_protect_message_immutability - fix search_path and use is_admin() RPC
CREATE OR REPLACE FUNCTION public.fn_protect_message_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.body IS DISTINCT FROM OLD.body
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.sender_role IS DISTINCT FROM OLD.sender_role
    OR NEW.message_type IS DISTINCT FROM OLD.message_type
    OR NEW.connection_request_id IS DISTINCT FROM OLD.connection_request_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only read status fields can be updated by non-admin users';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. refresh_materialized_views_safe - fix search_path
CREATE OR REPLACE FUNCTION public.refresh_materialized_views_safe()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'message', 'No materialized views to refresh — all views dropped as dead code',
    'started_at', NOW(),
    'completed_at', NOW(),
    'duration_ms', 0,
    'errors', '{}'::text[]
  );
END;
$function$;
