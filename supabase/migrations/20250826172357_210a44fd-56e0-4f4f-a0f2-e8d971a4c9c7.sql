-- Enable RLS and secure access on profiles_with_history without impacting existing app functionality
-- Safest minimal change: admin-only read; allow system/background inserts

-- Ensure table exists before applying (no-op if already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles_with_history'
  ) THEN
    RAISE NOTICE 'Table public.profiles_with_history does not exist; skipping RLS setup.';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE IF EXISTS public.profiles_with_history ENABLE ROW LEVEL SECURITY;

-- Clean up old policies if they exist
DROP POLICY IF EXISTS "Admins can view profiles_with_history" ON public.profiles_with_history;
DROP POLICY IF EXISTS "System can insert profiles_with_history" ON public.profiles_with_history;

-- Admins can view snapshots
CREATE POLICY "Admins can view profiles_with_history"
ON public.profiles_with_history
FOR SELECT
USING (is_admin(auth.uid()));

-- Allow system/background processes to insert rows (service role bypasses RLS; this ensures anon/authed clients cannot read)
CREATE POLICY "System can insert profiles_with_history"
ON public.profiles_with_history
FOR INSERT
WITH CHECK (true);
