-- Secure alert_delivery_logs: prevent public reads, keep admin/user visibility, preserve system functionality

-- 1) Ensure RLS is enabled
ALTER TABLE public.alert_delivery_logs ENABLE ROW LEVEL SECURITY;

-- 2) Drop overly broad policy that allowed public access
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'alert_delivery_logs' 
      AND policyname = 'System can manage alert delivery logs'
  ) THEN
    EXECUTE 'DROP POLICY "System can manage alert delivery logs" ON public.alert_delivery_logs';
  END IF;
END $$;

-- 3) Ensure admin and user SELECT policies exist (idempotent guards)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'alert_delivery_logs' 
      AND policyname = 'Admins can view all alert delivery logs'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Admins can view all alert delivery logs"
      ON public.alert_delivery_logs
      FOR SELECT
      USING (public.is_admin(auth.uid()));
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'alert_delivery_logs' 
      AND policyname = 'Users can view their own alert delivery logs'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Users can view their own alert delivery logs"
      ON public.alert_delivery_logs
      FOR SELECT
      USING (auth.uid() = user_id);
    $$;
  END IF;
END $$;

-- 4) Add explicit admin-only write policies so triggers/admin actions keep working
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'alert_delivery_logs' 
      AND policyname = 'Admins can insert alert delivery logs'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Admins can insert alert delivery logs"
      ON public.alert_delivery_logs
      FOR INSERT
      WITH CHECK (public.is_admin(auth.uid()));
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'alert_delivery_logs' 
      AND policyname = 'Admins can update alert delivery logs'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Admins can update alert delivery logs"
      ON public.alert_delivery_logs
      FOR UPDATE
      USING (public.is_admin(auth.uid()));
    $$;
  END IF;
END $$;

-- Note:
-- - Edge Functions using the service role key bypass RLS and remain unaffected.
-- - Users can only read their own rows; admins can read all and write as needed.
