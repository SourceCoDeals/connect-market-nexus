-- Fix permissive RLS policies (WARN 2, 3, 4 from linter)
-- Tighten daily_metrics to admin-only access

DROP POLICY IF EXISTS "System can manage daily metrics" ON public.daily_metrics;

CREATE POLICY "Only admins can view daily metrics"
ON public.daily_metrics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

CREATE POLICY "Only admins can insert daily metrics"
ON public.daily_metrics
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

CREATE POLICY "Only admins can update daily metrics"
ON public.daily_metrics
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

CREATE POLICY "Only admins can delete daily metrics"
ON public.daily_metrics
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

-- Tighten registration_funnel to admin-only access
DROP POLICY IF EXISTS "System can manage registration funnel" ON public.registration_funnel;

CREATE POLICY "Only admins can view registration funnel"
ON public.registration_funnel
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

CREATE POLICY "Only admins can insert registration funnel"
ON public.registration_funnel
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

CREATE POLICY "Only admins can update registration funnel"
ON public.registration_funnel
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

CREATE POLICY "Only admins can delete registration funnel"
ON public.registration_funnel
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

-- Tighten remarketing_outreach to admin-only access
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.remarketing_outreach;

CREATE POLICY "Only admins can view remarketing outreach"
ON public.remarketing_outreach
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

CREATE POLICY "Only admins can insert remarketing outreach"
ON public.remarketing_outreach
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

CREATE POLICY "Only admins can update remarketing outreach"
ON public.remarketing_outreach
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

CREATE POLICY "Only admins can delete remarketing outreach"
ON public.remarketing_outreach
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

-- Fix function search_path (WARN 1)
CREATE OR REPLACE FUNCTION public.update_remarketing_outreach_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;