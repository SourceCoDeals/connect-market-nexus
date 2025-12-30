-- Fix get_permission_audit_log() function: varchar(255) vs text type mismatch
-- Cast auth.users.email to text to match the declared return type

CREATE OR REPLACE FUNCTION public.get_permission_audit_log(filter_user_id uuid DEFAULT NULL::uuid, limit_count integer DEFAULT 100)
 RETURNS TABLE(id uuid, target_user_id uuid, target_email text, target_name text, changed_by uuid, changer_email text, changer_name text, old_role app_role, new_role app_role, reason text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only owners can view audit logs
  IF NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only owners can view permission audit logs';
  END IF;
  
  RETURN QUERY
  SELECT 
    pal.id,
    pal.target_user_id,
    tu.email::text AS target_email,
    COALESCE(tp.first_name || ' ' || tp.last_name, tu.email::text) AS target_name,
    pal.changed_by,
    cu.email::text AS changer_email,
    COALESCE(cp.first_name || ' ' || cp.last_name, cu.email::text) AS changer_name,
    pal.old_role,
    pal.new_role,
    pal.reason,
    pal.created_at
  FROM public.permission_audit_log pal
  LEFT JOIN auth.users tu ON pal.target_user_id = tu.id
  LEFT JOIN public.profiles tp ON pal.target_user_id = tp.id
  LEFT JOIN auth.users cu ON pal.changed_by = cu.id
  LEFT JOIN public.profiles cp ON pal.changed_by = cp.id
  WHERE (filter_user_id IS NULL OR pal.target_user_id = filter_user_id)
  ORDER BY pal.created_at DESC
  LIMIT limit_count;
END;
$function$;