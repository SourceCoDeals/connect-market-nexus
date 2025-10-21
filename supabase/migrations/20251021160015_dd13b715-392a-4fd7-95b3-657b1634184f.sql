-- Update old RPC functions to use new role system
-- This prevents data inconsistency and ensures all role changes go through the audit system

CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use new role system instead of directly updating profiles
  RETURN public.change_user_role(target_user_id, 'admin', 'Promoted via legacy promote_user_to_admin function');
END;
$$;

CREATE OR REPLACE FUNCTION public.demote_admin_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use new role system instead of directly updating profiles
  RETURN public.change_user_role(target_user_id, 'user', 'Demoted via legacy demote_admin_user function');
END;
$$;