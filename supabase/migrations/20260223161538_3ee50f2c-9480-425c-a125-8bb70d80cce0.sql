
-- Fix enrichment_queue admin policy to also check is_admin flag
DROP POLICY IF EXISTS "Admins can manage enrichment queue" ON public.enrichment_queue;
CREATE POLICY "Admins can manage enrichment queue"
ON public.enrichment_queue
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.is_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.is_admin = true)
  )
);

-- Also fix the SELECT-only policy to be consistent
DROP POLICY IF EXISTS "Admins can view enrichment queue" ON public.enrichment_queue;
CREATE POLICY "Admins can view enrichment queue"
ON public.enrichment_queue
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.is_admin = true)
  )
);
