-- ============================================================================
-- RLS Security Hardening (idempotent)
-- ============================================================================

-- 1. user_sessions
DROP POLICY IF EXISTS "System can update sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.user_sessions;
CREATE POLICY "Users can update own sessions"
  ON public.user_sessions FOR UPDATE
  USING (user_id IS NULL OR auth.uid() = user_id)
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.user_sessions;
CREATE POLICY "Users can insert own sessions"
  ON public.user_sessions FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- 2. otp_rate_limits
DROP POLICY IF EXISTS "System can manage OTP rate limits" ON public.otp_rate_limits;
DROP POLICY IF EXISTS "Admins can view OTP rate limits" ON public.otp_rate_limits;
CREATE POLICY "Admins can view OTP rate limits"
  ON public.otp_rate_limits FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 3. registration_funnel
DROP POLICY IF EXISTS "System can manage registration funnel" ON public.registration_funnel;
DROP POLICY IF EXISTS "Anyone can insert registration funnel data" ON public.registration_funnel;
CREATE POLICY "Anyone can insert registration funnel data"
  ON public.registration_funnel FOR INSERT
  WITH CHECK (true);

-- 4. daily_metrics
DROP POLICY IF EXISTS "System can manage daily metrics" ON public.daily_metrics;

-- 5. alert_delivery_logs
DROP POLICY IF EXISTS "System can manage alert delivery logs" ON public.alert_delivery_logs;

-- 6. cron_job_logs
DROP POLICY IF EXISTS "Authenticated users can view cron logs" ON public.cron_job_logs;
DROP POLICY IF EXISTS "Admins can view cron logs" ON public.cron_job_logs;
CREATE POLICY "Admins can view cron logs"
  ON public.cron_job_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 7. page_views
DROP POLICY IF EXISTS "System can insert page views" ON public.page_views;
DROP POLICY IF EXISTS "Users can insert own page views" ON public.page_views;
CREATE POLICY "Users can insert own page views"
  ON public.page_views FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- 8. user_events
DROP POLICY IF EXISTS "System can insert events" ON public.user_events;
DROP POLICY IF EXISTS "Users can insert own events" ON public.user_events;
CREATE POLICY "Users can insert own events"
  ON public.user_events FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- 9. listing_analytics
DROP POLICY IF EXISTS "System can insert listing analytics" ON public.listing_analytics;
DROP POLICY IF EXISTS "Users can insert own listing analytics" ON public.listing_analytics;
CREATE POLICY "Users can insert own listing analytics"
  ON public.listing_analytics FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- 10. search_analytics
DROP POLICY IF EXISTS "System can insert search analytics" ON public.search_analytics;
DROP POLICY IF EXISTS "Users can insert own search analytics" ON public.search_analytics;
CREATE POLICY "Users can insert own search analytics"
  ON public.search_analytics FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);