-- Add admin attribution columns to connection_requests
ALTER TABLE public.connection_requests
ADD COLUMN IF NOT EXISTS lead_nda_signed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS lead_nda_email_sent_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS lead_fee_agreement_signed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS lead_fee_agreement_email_sent_by uuid REFERENCES auth.users(id);

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.update_lead_nda_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_nda_email_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_email_status(uuid, boolean);

-- Recreate functions with _by tracking
CREATE FUNCTION public.update_lead_nda_status(
  request_id uuid,
  is_signed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.connection_requests
  SET 
    lead_nda_signed = is_signed,
    lead_nda_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    lead_nda_signed_by = CASE WHEN is_signed THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;
END;
$$;

CREATE FUNCTION public.update_lead_nda_email_status(
  request_id uuid,
  email_sent boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.connection_requests
  SET 
    lead_nda_email_sent = email_sent,
    lead_nda_email_sent_at = CASE WHEN email_sent THEN NOW() ELSE NULL END,
    lead_nda_email_sent_by = CASE WHEN email_sent THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;
END;
$$;

CREATE FUNCTION public.update_lead_fee_agreement_status(
  request_id uuid,
  is_signed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_signed = is_signed,
    lead_fee_agreement_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    lead_fee_agreement_signed_by = CASE WHEN is_signed THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;
END;
$$;

CREATE FUNCTION public.update_lead_fee_agreement_email_status(
  request_id uuid,
  email_sent boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_email_sent = email_sent,
    lead_fee_agreement_email_sent_at = CASE WHEN email_sent THEN NOW() ELSE NULL END,
    lead_fee_agreement_email_sent_by = CASE WHEN email_sent THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;
END;
$$;