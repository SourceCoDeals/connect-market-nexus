-- RLS & Security Fixes from buyer experience audit

-- #82: Drop overly broad listings SELECT policy
-- "Approved users can view listings" bypasses buyer_type visibility filter
-- The buyer-type-aware policy already covers approved users properly
DROP POLICY IF EXISTS "Approved users can view listings" ON listings;

-- #83: Remove duplicate connection_requests policies
DROP POLICY IF EXISTS "Users can view their own connection requests" ON connection_requests;
DROP POLICY IF EXISTS "Users can insert own connection requests" ON connection_requests;

-- #84: Protect sensitive profile fields from non-admin self-update
CREATE OR REPLACE FUNCTION protect_sensitive_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.approval_status := OLD.approval_status;
  NEW.is_admin := OLD.is_admin;
  NEW.buyer_quality_score := OLD.buyer_quality_score;
  NEW.buyer_quality_score_last_calculated := OLD.buyer_quality_score_last_calculated;
  NEW.buyer_tier := OLD.buyer_tier;
  NEW.admin_tier_override := OLD.admin_tier_override;
  NEW.admin_override_note := OLD.admin_override_note;
  NEW.role := OLD.role;
  NEW.email_verified := OLD.email_verified;
  NEW.remarketing_buyer_id := OLD.remarketing_buyer_id;
  NEW.platform_signal_detected := OLD.platform_signal_detected;
  NEW.platform_signal_source := OLD.platform_signal_source;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_sensitive_profile_fields();
