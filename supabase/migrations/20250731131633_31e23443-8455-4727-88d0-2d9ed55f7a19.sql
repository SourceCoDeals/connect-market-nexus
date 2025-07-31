-- Create test functions to debug admin authentication issue
CREATE OR REPLACE FUNCTION public.test_admin_status()
RETURNS table(
  current_uid uuid,
  profile_exists boolean,
  is_admin_value boolean,
  is_admin_function_result boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_uid,
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid()) as profile_exists,
    COALESCE((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()), false) as is_admin_value,
    public.is_admin(auth.uid()) as is_admin_function_result;
END;
$function$;

-- Also create a safer version of the fee agreement update that shows what's happening
CREATE OR REPLACE FUNCTION public.debug_fee_agreement_update(target_user_id uuid, is_sent boolean)
RETURNS table(
  auth_uid uuid,
  admin_check boolean,
  target_user_exists boolean,
  can_proceed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as auth_uid,
    public.is_admin(auth.uid()) as admin_check,
    EXISTS(SELECT 1 FROM public.profiles WHERE id = target_user_id) as target_user_exists,
    public.is_admin(auth.uid()) as can_proceed;
END;
$function$;