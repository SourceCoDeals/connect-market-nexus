-- Security hardening: revoke broad grants and add secure search_path to functions

-- 1) Revoke any broad privileges from anon/authenticated roles
REVOKE ALL ON TABLE public.alert_delivery_logs FROM anon;
REVOKE ALL ON TABLE public.alert_delivery_logs FROM authenticated;
REVOKE ALL ON TABLE public.otp_rate_limits FROM anon;
REVOKE ALL ON TABLE public.otp_rate_limits FROM authenticated;

-- 2) Ensure RLS is enabled on the sensitive tables
ALTER TABLE public.alert_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies for these tables are already defined in the project. This migration only hardens GRANTs and function search_path.

-- 3) Add explicit, safe search_path to functions flagged for security best practices
-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- update_listing_notes_updated_at
CREATE OR REPLACE FUNCTION public.update_listing_notes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- generate_deal_identifier (SECURITY DEFINER) with empty search_path for safety
CREATE OR REPLACE FUNCTION public.generate_deal_identifier()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    current_year TEXT;
    next_sequence INTEGER;
    new_identifier TEXT;
BEGIN
    -- Get current year
    current_year := EXTRACT(year FROM NOW())::TEXT;
    
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(
        CASE 
            WHEN deal_identifier ~ ('^SCO-' || current_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(deal_identifier FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_sequence
    FROM public.listings;
    
    -- Format the identifier
    new_identifier := 'SCO-' || current_year || '-' || LPAD(next_sequence::TEXT, 3, '0');
    
    RETURN new_identifier;
END;
$function$;

-- auto_generate_deal_identifier ensuring fully-qualified call and safe search_path
CREATE OR REPLACE FUNCTION public.auto_generate_deal_identifier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.deal_identifier IS NULL THEN
        NEW.deal_identifier := public.generate_deal_identifier();
    END IF;
    RETURN NEW;
END;
$function$;