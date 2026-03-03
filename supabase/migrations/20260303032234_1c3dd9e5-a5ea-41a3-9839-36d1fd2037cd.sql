
CREATE OR REPLACE FUNCTION public.get_internal_team_members()
RETURNS TABLE(user_id uuid, first_name text, last_name text, email text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (ur.user_id)
    ur.user_id,
    p.first_name::text,
    p.last_name::text,
    p.email::text,
    ur.role::text
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role IN ('owner', 'admin', 'moderator')
  ORDER BY ur.user_id, ur.role
$$;
