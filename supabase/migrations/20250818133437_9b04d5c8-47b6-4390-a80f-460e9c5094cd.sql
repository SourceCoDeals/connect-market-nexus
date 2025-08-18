-- Secure alert_delivery_logs: prevent public reads, keep admin/user visibility, preserve system functionality

-- 1) Ensure RLS is enabled
ALTER TABLE public.alert_delivery_logs ENABLE ROW LEVEL SECURITY;

-- 2) Drop overly broad policy that allowed public access
DROP POLICY IF EXISTS "System can manage alert delivery logs" ON public.alert_delivery_logs;

-- 3) Create admin SELECT policy (idempotent)
DROP POLICY IF EXISTS "Admins can view all alert delivery logs" ON public.alert_delivery_logs;
CREATE POLICY "Admins can view all alert delivery logs"
ON public.alert_delivery_logs
FOR SELECT
USING (public.is_admin(auth.uid()));

-- 4) Create user SELECT policy (idempotent)
DROP POLICY IF EXISTS "Users can view their own alert delivery logs" ON public.alert_delivery_logs;
CREATE POLICY "Users can view their own alert delivery logs"
ON public.alert_delivery_logs
FOR SELECT
USING (auth.uid() = user_id);

-- 5) Add explicit admin-only write policies for triggers/admin actions
DROP POLICY IF EXISTS "Admins can insert alert delivery logs" ON public.alert_delivery_logs;
CREATE POLICY "Admins can insert alert delivery logs"
ON public.alert_delivery_logs
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update alert delivery logs" ON public.alert_delivery_logs;
CREATE POLICY "Admins can update alert delivery logs"
ON public.alert_delivery_logs
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Note:
-- - Edge Functions using the service role key bypass RLS and remain unaffected.
-- - Users can only read their own rows; admins can read all and write as needed.