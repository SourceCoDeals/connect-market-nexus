-- Create app_role enum with hierarchy
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reason TEXT,
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create permission_audit_log table
CREATE TABLE public.permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  old_role public.app_role,
  new_role public.app_role NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on audit log
ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user has a role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create security definer function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'owner'
  )
$$;

-- Create function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'moderator' THEN 3
    WHEN 'user' THEN 4
  END
  LIMIT 1
$$;

-- Create function to change user role (owner only)
CREATE OR REPLACE FUNCTION public.change_user_role(
  target_user_id UUID,
  new_role public.app_role,
  change_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  old_role public.app_role;
  target_email TEXT;
BEGIN
  -- Get caller ID
  caller_id := auth.uid();
  
  -- Check if caller is owner
  IF NOT public.is_owner(caller_id) THEN
    RAISE EXCEPTION 'Only owners can change user roles';
  END IF;
  
  -- Prevent owner from demoting themselves
  IF caller_id = target_user_id AND new_role != 'owner' THEN
    RAISE EXCEPTION 'Owners cannot demote themselves';
  END IF;
  
  -- Get target user email
  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  
  -- Prevent changing the owner role of ahaile14@gmail.com
  IF target_email = 'ahaile14@gmail.com' AND new_role != 'owner' THEN
    RAISE EXCEPTION 'Cannot change the owner role of the primary owner';
  END IF;
  
  -- Prevent creating multiple owners
  IF new_role = 'owner' AND target_email != 'ahaile14@gmail.com' THEN
    RAISE EXCEPTION 'Only ahaile14@gmail.com can have the owner role';
  END IF;
  
  -- Get old role
  old_role := public.get_user_role(target_user_id);
  
  -- Delete existing roles for this user
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Insert new role
  INSERT INTO public.user_roles (user_id, role, assigned_by, reason)
  VALUES (target_user_id, new_role, caller_id, change_reason);
  
  -- Log the change
  INSERT INTO public.permission_audit_log (
    target_user_id,
    changed_by,
    old_role,
    new_role,
    reason
  ) VALUES (
    target_user_id,
    caller_id,
    old_role,
    new_role,
    change_reason
  );
  
  -- Sync with profiles table for backward compatibility
  UPDATE public.profiles
  SET 
    is_admin = (new_role IN ('owner', 'admin')),
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$$;

-- Create function to get permission audit log
CREATE OR REPLACE FUNCTION public.get_permission_audit_log(
  filter_user_id UUID DEFAULT NULL,
  limit_count INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  target_user_id UUID,
  target_email TEXT,
  target_name TEXT,
  changed_by UUID,
  changer_email TEXT,
  changer_name TEXT,
  old_role public.app_role,
  new_role public.app_role,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only owners can view audit logs
  IF NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only owners can view permission audit logs';
  END IF;
  
  RETURN QUERY
  SELECT 
    pal.id,
    pal.target_user_id,
    tu.email AS target_email,
    COALESCE(tp.first_name || ' ' || tp.last_name, tu.email) AS target_name,
    pal.changed_by,
    cu.email AS changer_email,
    COALESCE(cp.first_name || ' ' || cp.last_name, cu.email) AS changer_name,
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
$$;

-- RLS Policies for user_roles
CREATE POLICY "Owners can view all user roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.is_owner(auth.uid()));

CREATE POLICY "Owners can manage all user roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- RLS Policies for permission_audit_log
CREATE POLICY "Owners can view all audit logs"
  ON public.permission_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_owner(auth.uid()));

CREATE POLICY "System can insert audit logs"
  ON public.permission_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Migrate existing admins to user_roles table
INSERT INTO public.user_roles (user_id, role, assigned_by, reason)
SELECT 
  p.id,
  CASE 
    WHEN u.email = 'ahaile14@gmail.com' THEN 'owner'::public.app_role
    WHEN p.is_admin = true THEN 'admin'::public.app_role
    ELSE 'user'::public.app_role
  END,
  NULL,
  'Initial migration from is_admin field'
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.deleted_at IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Create index for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_permission_audit_target ON public.permission_audit_log(target_user_id);
CREATE INDEX idx_permission_audit_created ON public.permission_audit_log(created_at DESC);