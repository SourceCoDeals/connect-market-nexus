-- Migration: Add audit logging for sensitive operations
-- Tracks changes to scores, buyer data, and admin actions

-- =============================================================
-- CREATE AUDIT LOG TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  is_admin BOOLEAN DEFAULT false,

  -- What was done
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'override', 'approve', 'pass', 'import', 'enrich'
  entity_type TEXT NOT NULL, -- 'listing', 'buyer', 'score', 'universe', 'profile'
  entity_id UUID,

  -- Change details
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],

  -- Context
  reason TEXT, -- For overrides, passes, etc.
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by entity
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Index for querying by user
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);

-- Index for querying by action
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Index for time-based queries
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Composite index for admin dashboard queries
CREATE INDEX idx_audit_logs_admin_view ON public.audit_logs(created_at DESC, action, entity_type);

-- =============================================================
-- CREATE AUDIT LOG FUNCTION
-- =============================================================

CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id UUID,
  p_user_email TEXT,
  p_is_admin BOOLEAN,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id UUID;
  v_changed_fields TEXT[];
BEGIN
  -- Calculate changed fields if both old and new values provided
  IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    SELECT array_agg(key)
    INTO v_changed_fields
    FROM (
      SELECT key FROM jsonb_object_keys(p_new_values) AS key
      WHERE p_old_values->key IS DISTINCT FROM p_new_values->key
    ) changed;
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    is_admin,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    changed_fields,
    reason,
    request_id
  )
  VALUES (
    p_user_id,
    p_user_email,
    p_is_admin,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values,
    v_changed_fields,
    p_reason,
    p_request_id
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

-- =============================================================
-- CREATE TRIGGERS FOR AUTOMATIC AUDIT LOGGING
-- =============================================================

-- Trigger function for score changes (especially overrides)
CREATE OR REPLACE FUNCTION audit_score_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log score overrides specifically
  IF TG_OP = 'UPDATE' AND
     (OLD.human_override_score IS DISTINCT FROM NEW.human_override_score OR
      OLD.status IS DISTINCT FROM NEW.status) THEN

    PERFORM log_audit_event(
      auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true),
      CASE
        WHEN NEW.human_override_score IS NOT NULL AND OLD.human_override_score IS NULL THEN 'override'
        WHEN NEW.status = 'approved' THEN 'approve'
        WHEN NEW.status = 'passed' THEN 'pass'
        ELSE 'update'
      END,
      'score',
      NEW.id,
      jsonb_build_object(
        'composite_score', OLD.composite_score,
        'human_override_score', OLD.human_override_score,
        'status', OLD.status
      ),
      jsonb_build_object(
        'composite_score', NEW.composite_score,
        'human_override_score', NEW.human_override_score,
        'status', NEW.status
      ),
      NEW.pass_reason
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to remarketing_scores
DROP TRIGGER IF EXISTS audit_score_changes_trigger ON public.remarketing_scores;
CREATE TRIGGER audit_score_changes_trigger
  AFTER UPDATE ON public.remarketing_scores
  FOR EACH ROW
  EXECUTE FUNCTION audit_score_changes();

-- Trigger function for buyer data changes
CREATE OR REPLACE FUNCTION audit_buyer_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_sensitive_fields TEXT[] := ARRAY['thesis_summary', 'target_geographies', 'target_revenue_min', 'target_revenue_max', 'deal_breakers'];
  v_changed_sensitive BOOLEAN := false;
BEGIN
  -- Check if any sensitive fields changed
  IF TG_OP = 'UPDATE' THEN
    v_changed_sensitive := (
      OLD.thesis_summary IS DISTINCT FROM NEW.thesis_summary OR
      OLD.target_geographies IS DISTINCT FROM NEW.target_geographies OR
      OLD.target_revenue_min IS DISTINCT FROM NEW.target_revenue_min OR
      OLD.target_revenue_max IS DISTINCT FROM NEW.target_revenue_max OR
      OLD.deal_breakers IS DISTINCT FROM NEW.deal_breakers
    );
  END IF;

  -- Only log if sensitive fields changed or it's a create/delete
  IF TG_OP = 'INSERT' OR TG_OP = 'DELETE' OR v_changed_sensitive THEN
    PERFORM log_audit_event(
      auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true),
      LOWER(TG_OP),
      'buyer',
      COALESCE(NEW.id, OLD.id),
      CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) END,
      CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) END,
      NULL
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to remarketing_buyers
DROP TRIGGER IF EXISTS audit_buyer_changes_trigger ON public.remarketing_buyers;
CREATE TRIGGER audit_buyer_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.remarketing_buyers
  FOR EACH ROW
  EXECUTE FUNCTION audit_buyer_changes();

-- =============================================================
-- CREATE AUDIT LOG VIEWS FOR ADMIN DASHBOARD
-- =============================================================

-- Recent activity view
CREATE OR REPLACE VIEW public.recent_audit_activity AS
SELECT
  al.id,
  al.action,
  al.entity_type,
  al.entity_id,
  al.user_email,
  al.is_admin,
  al.changed_fields,
  al.reason,
  al.created_at,
  CASE al.entity_type
    WHEN 'buyer' THEN (SELECT company_name FROM remarketing_buyers WHERE id = al.entity_id)
    WHEN 'listing' THEN (SELECT title FROM listings WHERE id = al.entity_id)
    WHEN 'score' THEN (
      SELECT b.company_name || ' → ' || l.title
      FROM remarketing_scores s
      JOIN remarketing_buyers b ON s.buyer_id = b.id
      JOIN listings l ON s.listing_id = l.id
      WHERE s.id = al.entity_id
    )
    ELSE NULL
  END AS entity_name
FROM public.audit_logs al
ORDER BY al.created_at DESC
LIMIT 100;

-- Score override history view
CREATE OR REPLACE VIEW public.score_override_history AS
SELECT
  al.id,
  al.entity_id AS score_id,
  al.user_email AS overridden_by,
  (al.old_values->>'composite_score')::NUMERIC AS original_score,
  (al.new_values->>'human_override_score')::NUMERIC AS override_score,
  al.old_values->>'status' AS old_status,
  al.new_values->>'status' AS new_status,
  al.reason,
  al.created_at,
  b.company_name AS buyer_name,
  l.title AS deal_name
FROM public.audit_logs al
LEFT JOIN public.remarketing_scores s ON al.entity_id = s.id
LEFT JOIN public.remarketing_buyers b ON s.buyer_id = b.id
LEFT JOIN public.listings l ON s.listing_id = l.id
WHERE al.entity_type = 'score'
  AND al.action IN ('override', 'approve', 'pass')
ORDER BY al.created_at DESC;

-- =============================================================
-- RLS POLICIES FOR AUDIT LOGS
-- =============================================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Only the system can insert audit logs (via security definer functions)
CREATE POLICY "audit_logs_system_insert" ON public.audit_logs
  FOR INSERT
  WITH CHECK (false); -- Inserts happen via SECURITY DEFINER functions

-- =============================================================
-- GRANT PERMISSIONS
-- =============================================================

GRANT SELECT ON public.recent_audit_activity TO authenticated;
GRANT SELECT ON public.score_override_history TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;

COMMENT ON TABLE public.audit_logs IS 'Audit trail for sensitive operations - score overrides, buyer edits, etc.';
COMMENT ON VIEW public.recent_audit_activity IS 'Recent audit events for admin dashboard';
COMMENT ON VIEW public.score_override_history IS 'History of score overrides with buyer/deal context';
