-- Drop the function first to avoid return type conflict
DROP FUNCTION IF EXISTS public.move_deal_stage_with_ownership(uuid, uuid, uuid) CASCADE;

-- PHASE 3 CONTINUED: Fix remaining SECURITY DEFINER functions missing search_path

CREATE FUNCTION public.move_deal_stage_with_ownership(
  p_deal_id uuid,
  p_new_stage_id uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE deals 
  SET 
    stage_id = p_new_stage_id,
    stage_entered_at = now(),
    updated_at = now()
  WHERE id = p_deal_id;
  
  INSERT INTO deal_activities (deal_id, activity_type, title, admin_id)
  VALUES (p_deal_id, 'stage_change', 'Stage changed', p_admin_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_all_admin_notifications(admin_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE admin_notifications 
  SET is_read = true, read_at = now() 
  WHERE admin_id = admin_uuid AND is_read = false;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_followup_to_connection_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.connection_request_id IS NOT NULL THEN
    UPDATE connection_requests
    SET 
      followed_up = NEW.followed_up,
      followed_up_at = NEW.followed_up_at,
      followed_up_by = NEW.followed_up_by,
      negative_followed_up = NEW.negative_followed_up,
      negative_followed_up_at = NEW.negative_followed_up_at,
      negative_followed_up_by = NEW.negative_followed_up_by
    WHERE id = NEW.connection_request_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_followup_to_deals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE deals
  SET 
    followed_up = NEW.followed_up,
    followed_up_at = NEW.followed_up_at,
    followed_up_by = NEW.followed_up_by,
    negative_followed_up = NEW.negative_followed_up,
    negative_followed_up_at = NEW.negative_followed_up_at,
    negative_followed_up_by = NEW.negative_followed_up_by
  WHERE connection_request_id = NEW.id;
  RETURN NEW;
END;
$$;

-- Fix the view with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.unmapped_primary_owners;
CREATE VIEW public.unmapped_primary_owners WITH (security_invoker = on) AS
SELECT 
  listings.id,
  listings.title,
  listings.internal_company_name,
  listings.internal_primary_owner,
  'No matching admin found - needs manual review'::text AS migration_status,
  listings.created_at
FROM listings
WHERE listings.internal_primary_owner IS NOT NULL 
  AND listings.internal_primary_owner <> ''
  AND listings.primary_owner_id IS NULL
ORDER BY listings.created_at DESC;

-- Fix remaining overly permissive policies

-- admin_notifications
DROP POLICY IF EXISTS "System can insert notifications" ON admin_notifications;
CREATE POLICY "Authenticated system can insert notifications" ON admin_notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- deal_referrals
DROP POLICY IF EXISTS "System can update referral tracking" ON deal_referrals;
CREATE POLICY "Admins can update referral tracking" ON deal_referrals
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

-- email_delivery_logs
DROP POLICY IF EXISTS "System can insert email delivery logs" ON email_delivery_logs;
DROP POLICY IF EXISTS "System can update email delivery logs" ON email_delivery_logs;
CREATE POLICY "Admins can manage email logs" ON email_delivery_logs
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- engagement_scores
DROP POLICY IF EXISTS "System can update all engagement scores" ON engagement_scores;
CREATE POLICY "Admins can update engagement scores" ON engagement_scores
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

-- owner_intro_notifications
DROP POLICY IF EXISTS "System can insert owner intro notifications" ON owner_intro_notifications;
CREATE POLICY "Authenticated can insert owner intro notifications" ON owner_intro_notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- permission_audit_log
DROP POLICY IF EXISTS "System can insert audit logs" ON permission_audit_log;
CREATE POLICY "Admins can insert audit logs" ON permission_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- profile_data_snapshots
DROP POLICY IF EXISTS "System can insert snapshots" ON profile_data_snapshots;
CREATE POLICY "Admins can insert profile snapshots" ON profile_data_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- user_initial_session
DROP POLICY IF EXISTS "System can update initial session data" ON user_initial_session;
CREATE POLICY "Users can update own initial session" ON user_initial_session
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- user_notifications
DROP POLICY IF EXISTS "System can insert notifications" ON user_notifications;
CREATE POLICY "Authenticated can insert user notifications" ON user_notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- user_sessions
DROP POLICY IF EXISTS "System can update sessions" ON user_sessions;
CREATE POLICY "Users can update own sessions" ON user_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);