
-- Migration: remarketing_contacts_mirror_trigger
-- Mirrors legacy remarketing_buyer_contacts writes to unified contacts table

CREATE OR REPLACE FUNCTION public.mirror_rbc_to_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mirror INSERT on remarketing_buyer_contacts → contacts (if not already present)
  INSERT INTO public.contacts (
    first_name,
    last_name,
    email,
    phone,
    linkedin_url,
    title,
    contact_type,
    remarketing_buyer_id,
    is_primary_at_firm,
    source,
    archived
  )
  VALUES (
    COALESCE(split_part(NEW.name, ' ', 1), NEW.name),
    CASE WHEN position(' ' in NEW.name) > 0 THEN substring(NEW.name from position(' ' in NEW.name) + 1) ELSE '' END,
    NEW.email,
    NEW.phone,
    NEW.linkedin_url,
    NEW.role,
    'buyer',
    NEW.buyer_id,
    COALESCE(NEW.is_primary, false),
    'legacy_mirror',
    false
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create the trigger on the legacy table
DROP TRIGGER IF EXISTS trg_mirror_rbc_to_contacts ON public.remarketing_buyer_contacts;
CREATE TRIGGER trg_mirror_rbc_to_contacts
  AFTER INSERT ON public.remarketing_buyer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_rbc_to_contacts();
