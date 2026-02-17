-- CapTarget Sync Exclusions
-- Tracks companies blocked from import (PE/VC/advisory firms) with full audit trail

-- 1. Create exclusions table
CREATE TABLE IF NOT EXISTS public.captarget_sync_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  excluded_at TIMESTAMPTZ DEFAULT now(),
  company_name TEXT,
  contact_title TEXT,
  description_snippet TEXT,
  exclusion_reason TEXT NOT NULL,
  exclusion_category TEXT NOT NULL,
  source TEXT DEFAULT 'sync',
  captarget_row_hash TEXT,
  raw_row_data JSONB
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_captarget_exclusions_excluded_at
  ON public.captarget_sync_exclusions (excluded_at DESC);

CREATE INDEX IF NOT EXISTS idx_captarget_exclusions_category
  ON public.captarget_sync_exclusions (exclusion_category);

-- 3. RLS (mirrors captarget_sync_log pattern)
ALTER TABLE public.captarget_sync_exclusions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admin users can view captarget sync exclusions'
  ) THEN
    CREATE POLICY "Admin users can view captarget sync exclusions"
      ON public.captarget_sync_exclusions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage captarget sync exclusions'
  ) THEN
    CREATE POLICY "Service role can manage captarget sync exclusions"
      ON public.captarget_sync_exclusions FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. Add rows_excluded to sync log
ALTER TABLE public.captarget_sync_log
  ADD COLUMN IF NOT EXISTS rows_excluded INTEGER DEFAULT 0;
