
-- Align RLS read access on contact backfill tables with is_admin()
-- so owner, admin, and moderator roles can all see live progress.

DROP POLICY IF EXISTS "Admins can read contact backfill runs" ON public.contact_backfill_runs;
DROP POLICY IF EXISTS "Admins can read contact backfill queue" ON public.contact_backfill_queue;

CREATE POLICY "Admin team can read contact backfill runs"
  ON public.contact_backfill_runs
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin team can read contact backfill queue"
  ON public.contact_backfill_queue
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Ensure realtime delivers row changes for both tables (full row payloads).
ALTER TABLE public.contact_backfill_runs REPLICA IDENTITY FULL;
ALTER TABLE public.contact_backfill_queue REPLICA IDENTITY FULL;

-- Add to supabase_realtime publication if not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'contact_backfill_runs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_backfill_runs';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'contact_backfill_queue'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_backfill_queue';
  END IF;
END $$;
