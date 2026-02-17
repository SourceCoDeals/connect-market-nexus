-- Consolidate contact fields: primary_contact_* → main_contact_*
-- primary_contact_* is a legacy duplicate of main_contact_*; merge any orphaned data then drop.

-- 1. Copy primary_contact values into main_contact where main is missing (only if columns exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'primary_contact_name'
  ) THEN
    UPDATE public.listings
    SET
      main_contact_name  = COALESCE(main_contact_name, primary_contact_name),
      main_contact_email = COALESCE(main_contact_email, primary_contact_email),
      main_contact_phone = COALESCE(main_contact_phone, primary_contact_phone)
    WHERE primary_contact_name IS NOT NULL
       OR primary_contact_email IS NOT NULL
       OR primary_contact_phone IS NOT NULL;
  END IF;
END $$;

-- 2. Drop legacy columns
ALTER TABLE public.listings
  DROP COLUMN IF EXISTS primary_contact_name,
  DROP COLUMN IF EXISTS primary_contact_email,
  DROP COLUMN IF EXISTS primary_contact_phone;

-- 3. Drop owner_* contact columns if they somehow exist (never migrated, but clean up just in case)
ALTER TABLE public.listings
  DROP COLUMN IF EXISTS owner_first_name,
  DROP COLUMN IF EXISTS owner_last_name,
  DROP COLUMN IF EXISTS owner_email,
  DROP COLUMN IF EXISTS owner_phone;
