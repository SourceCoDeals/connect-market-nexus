-- Fix get_all_user_roles return type mismatch (varchar(255) vs text)
CREATE OR REPLACE FUNCTION public.get_all_user_roles()
RETURNS TABLE(
  user_id uuid,
  role app_role,
  granted_at timestamptz,
  granted_by uuid,
  user_email text,
  user_first_name text,
  user_last_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_owner(auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ur.user_id,
    ur.role,
    ur.granted_at,
    ur.granted_by,
    au.email::text as user_email,
    p.first_name::text as user_first_name,
    p.last_name::text as user_last_name
  FROM public.user_roles ur
  LEFT JOIN auth.users au ON ur.user_id = au.id
  LEFT JOIN public.profiles p ON ur.user_id = p.id
  ORDER BY
    CASE ur.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'moderator' THEN 3
      ELSE 4
    END,
    ur.granted_at DESC;
END;
$$;