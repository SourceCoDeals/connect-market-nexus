-- Lock down otp_rate_limits RLS to prevent email harvesting
-- Ensure RLS is enabled
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Remove overly permissive policy that allowed broad access
DROP POLICY IF EXISTS "System can manage OTP rate limits" ON public.otp_rate_limits;

-- Intentionally do NOT add any new policies.
-- With no policies, no client roles (anon/authenticated) can access this table.
-- The Edge Function uses the service role key and bypasses RLS, so functionality remains intact.