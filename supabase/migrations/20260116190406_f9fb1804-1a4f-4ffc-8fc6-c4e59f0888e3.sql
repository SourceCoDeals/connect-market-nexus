-- Fix 3 functions missing search_path

-- 1. Fix auto_assign_deal_from_listing
CREATE OR REPLACE FUNCTION public.auto_assign_deal_from_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.listing_id IS NOT NULL AND NEW.assigned_to IS NULL THEN
    SELECT primary_owner_id INTO NEW.assigned_to
    FROM listings
    WHERE id = NEW.listing_id
    AND primary_owner_id IS NOT NULL;
    
    IF NEW.assigned_to IS NOT NULL THEN
      NEW.owner_assigned_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Fix create_deal_from_connection_request
CREATE OR REPLACE FUNCTION public.create_deal_from_connection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  default_stage_id uuid;
  new_deal_id uuid;
  listing_title text;
BEGIN
  IF NEW.status = 'converted' AND OLD.status != 'converted' THEN
    SELECT id INTO default_stage_id FROM deal_stages WHERE is_default = true LIMIT 1;
    
    IF default_stage_id IS NULL THEN
      SELECT id INTO default_stage_id FROM deal_stages ORDER BY position LIMIT 1;
    END IF;
    
    SELECT title INTO listing_title FROM listings WHERE id = NEW.listing_id;
    
    INSERT INTO deals (
      title, stage_id, connection_request_id, listing_id,
      contact_name, contact_email, contact_company, contact_phone, contact_role,
      source, buyer_priority_score
    ) VALUES (
      COALESCE(listing_title, 'Converted Deal'),
      default_stage_id, NEW.id, NEW.listing_id,
      NEW.lead_name, NEW.lead_email, NEW.lead_company, NEW.lead_phone, NEW.lead_role,
      'connection_request', NEW.buyer_priority_score
    ) RETURNING id INTO new_deal_id;
    
    NEW.converted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Fix reset_all_admin_notifications
CREATE OR REPLACE FUNCTION public.reset_all_admin_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE admin_notifications SET is_read = false, read_at = NULL;
END;
$$;

-- Fix 6 remaining permissive INSERT policies

-- 1. Fix page_views - allow unauthenticated for analytics but require session_id
DROP POLICY IF EXISTS "System can insert page views" ON page_views;
CREATE POLICY "Allow page view inserts with session" ON page_views
  FOR INSERT
  WITH CHECK (session_id IS NOT NULL);

-- 2. Fix user_events - require user_id to match auth
DROP POLICY IF EXISTS "System can insert events" ON user_events;
CREATE POLICY "Users can insert own events" ON user_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Fix listing_analytics - allow both authenticated and anon with session
DROP POLICY IF EXISTS "System can insert listing analytics" ON listing_analytics;
CREATE POLICY "Allow listing analytics inserts with session" ON listing_analytics
  FOR INSERT
  WITH CHECK (session_id IS NOT NULL);

-- 4. Fix search_analytics - require user_id match
DROP POLICY IF EXISTS "System can insert search analytics" ON search_analytics;
CREATE POLICY "Users can insert own search analytics" ON search_analytics
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Fix user_sessions - require user_id match
DROP POLICY IF EXISTS "System can insert sessions" ON user_sessions;
CREATE POLICY "Users can insert own sessions" ON user_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 6. Fix user_initial_session - require user_id match
DROP POLICY IF EXISTS "System can insert initial session data" ON user_initial_session;
CREATE POLICY "Users can insert own initial session" ON user_initial_session
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);