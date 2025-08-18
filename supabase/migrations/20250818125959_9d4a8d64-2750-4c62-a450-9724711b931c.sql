-- Secure otp_rate_limits: enable RLS, remove broad access, restrict reads to admins only

-- 1) Ensure RLS is enabled
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- 2) Drop any existing policies on this table (to remove overly broad access)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'otp_rate_limits'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.otp_rate_limits', pol.policyname);
  END LOOP;
END $$;

-- 3) Create strict admin-only read policy
CREATE POLICY "Admins can view OTP rate limits"
ON public.otp_rate_limits
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Note: No INSERT/UPDATE/DELETE policies are created intentionally.
-- The Edge Function uses the service role key and bypasses RLS to manage this table.
