CREATE OR REPLACE FUNCTION public.sync_user_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    email_verified = (NEW.email_confirmed_at IS NOT NULL),
    updated_at = NOW()
  WHERE id = NEW.id
    AND email_verified IS DISTINCT FROM (NEW.email_confirmed_at IS NOT NULL);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
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
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
EXECUTE FUNCTION public.sync_user_verification_status();

DROP TRIGGER IF EXISTS on_auth_user_verification_inserted ON auth.users;
CREATE TRIGGER on_auth_user_verification_inserted
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_verification_status();

UPDATE public.profiles p
SET
  email_verified = (u.email_confirmed_at IS NOT NULL),
  updated_at = NOW()
FROM auth.users u
WHERE u.id = p.id
  AND p.email_verified IS DISTINCT FROM (u.email_confirmed_at IS NOT NULL);