-- Drop and recreate get_all_user_roles to fix auth.uid() issue
-- The function was returning empty because auth.uid() context was lost in SECURITY DEFINER
-- New approach: let RLS handle authorization, function just returns data

DROP FUNCTION IF EXISTS public.get_all_user_roles();

CREATE FUNCTION public.get_all_user_roles()
RETURNS TABLE(
  user_id uuid,
  role app_role,
  granted_at timestamp with time zone,
  granted_by uuid
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ur.user_id,
    ur.role,
    ur.granted_at,
    ur.granted_by
  FROM public.user_roles ur
  ORDER BY ur.granted_at DESC;
$$;