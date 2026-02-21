-- ============================================================================
-- RLS Security Hardening
-- ============================================================================
-- Fixes overly permissive USING(true) policies that allow any authenticated
-- user to read/modify other users' data. Service role bypasses RLS entirely,
-- so these "System can..." policies are unnecessary and dangerous.
-- ============================================================================

-- ============================================================================
-- 1. user_sessions: Fix UPDATE policy (any user can update any session)
-- ============================================================================
DROP POLICY IF EXISTS "System can update sessions" ON public.user_sessions;
-- Replace with: users can only update their own sessions
CREATE POLICY "Users can update own sessions"
  ON public.user_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Also tighten INSERT: users can only insert sessions for themselves
DROP POLICY IF EXISTS "System can insert sessions" ON public.user_sessions;
CREATE POLICY "Users can insert own sessions"
  ON public.user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 2. otp_rate_limits: Fix FOR ALL policy (any user can read/modify all OTP data)
-- ============================================================================
DROP POLICY IF EXISTS "System can manage OTP rate limits" ON public.otp_rate_limits;
-- OTP rate limits are checked by edge functions (service_role, bypasses RLS).
-- No authenticated user needs direct access to this table.
CREATE POLICY "Admins can view OTP rate limits"
  ON public.otp_rate_limits FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- 3. registration_funnel: Fix FOR ALL policy (any user can read all funnel data)
-- ============================================================================
DROP POLICY IF EXISTS "System can manage registration funnel" ON public.registration_funnel;
-- INSERT needed during signup (user may not be fully authenticated yet)
CREATE POLICY "Authenticated users can insert own funnel data"
  ON public.registration_funnel FOR INSERT
  WITH CHECK (true);
-- SELECT restricted to admins (the admin policy already exists)
-- "Admins can view registration funnel" already exists from original migration

-- ============================================================================
-- 4. daily_metrics: Fix FOR ALL policy (any user can read all metrics)
-- ============================================================================
DROP POLICY IF EXISTS "System can manage daily metrics" ON public.daily_metrics;
-- daily_metrics are computed by cron jobs (service_role, bypasses RLS).
-- Only admins should read them.
-- "Admins can view daily metrics" already exists from original migration

-- ============================================================================
-- 5. alert_delivery_logs: Fix FOR ALL policy (any user can read all alerts)
-- ============================================================================
DROP POLICY IF EXISTS "System can manage alert delivery logs" ON public.alert_delivery_logs;
-- Alert delivery is done by edge functions (service_role, bypasses RLS).
-- Only admins should read logs.
-- "Admins can view all alert delivery logs" already exists from original migration

-- ============================================================================
-- 6. cron_job_logs: Tighten SELECT to admin-only
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view cron logs" ON public.cron_job_logs;
CREATE POLICY "Admins can view cron logs"
  ON public.cron_job_logs FOR SELECT
  USING (public.is_admin(auth.uid()));
-- "Service role can insert cron logs" INSERT policy remains (needed for cron jobs
-- when running as authenticated context within SECURITY DEFINER functions)

-- ============================================================================
-- 7. page_views: Tighten INSERT to own data only
-- ============================================================================
DROP POLICY IF EXISTS "System can insert page views" ON public.page_views;
CREATE POLICY "Users can insert own page views"
  ON public.page_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 8. user_events: Tighten INSERT to own data only
-- ============================================================================
DROP POLICY IF EXISTS "System can insert events" ON public.user_events;
CREATE POLICY "Users can insert own events"
  ON public.user_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 9. listing_analytics: Tighten INSERT to own data only
-- ============================================================================
DROP POLICY IF EXISTS "System can insert listing analytics" ON public.listing_analytics;
CREATE POLICY "Users can insert own listing analytics"
  ON public.listing_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 10. search_analytics: Tighten INSERT to own data only
-- ============================================================================
DROP POLICY IF EXISTS "System can insert search analytics" ON public.search_analytics;
CREATE POLICY "Users can insert own search analytics"
  ON public.search_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);
