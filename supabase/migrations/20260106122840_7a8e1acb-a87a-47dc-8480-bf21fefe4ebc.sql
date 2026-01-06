-- Fix the check_orphaned_auth_users function to use correct type (varchar instead of text)
DROP FUNCTION IF EXISTS public.check_orphaned_auth_users();

CREATE OR REPLACE FUNCTION public.check_orphaned_auth_users()
RETURNS TABLE(user_id uuid, user_email varchar(255), created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  WHERE p.id IS NULL
  ORDER BY u.created_at DESC;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.check_orphaned_auth_users() TO service_role;