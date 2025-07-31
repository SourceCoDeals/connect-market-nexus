-- Clean up debug functions
DROP FUNCTION IF EXISTS public.test_admin_status();
DROP FUNCTION IF EXISTS public.debug_fee_agreement_update(uuid, boolean);