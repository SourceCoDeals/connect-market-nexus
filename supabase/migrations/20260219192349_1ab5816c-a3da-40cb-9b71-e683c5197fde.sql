ALTER TABLE public.listings 
  ADD COLUMN IF NOT EXISTS needs_owner_contact boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_owner_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_owner_contact_by uuid REFERENCES auth.users(id);