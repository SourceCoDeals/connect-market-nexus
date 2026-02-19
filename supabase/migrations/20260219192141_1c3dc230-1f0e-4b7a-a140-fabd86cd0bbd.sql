ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS universe_build_flagged boolean DEFAULT false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS universe_build_flagged_at timestamptz;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS universe_build_flagged_by uuid REFERENCES auth.users(id);