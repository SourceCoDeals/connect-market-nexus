-- ============================================================================
-- F-RLS1: Add granular RLS policies to deal_pipeline
-- ============================================================================
-- Currently the only policy is "Admins can manage all deal_pipeline" which
-- grants full CRUD to anyone with is_admin(auth.uid()). There is no per-user
-- filtering for non-admin roles.
--
-- This migration adds:
--   1. A read-only policy so buyers can see deals where they are the
--      connection_request user (self-service portal visibility).
--   2. A policy so the deal owner (assigned_to) can update their own deals
--      without admin status — future-proofing for team member roles.
-- ============================================================================

-- 1. Buyers can view their own deals (read-only via connection_request)
CREATE POLICY "Buyers can view own deals via connection_request"
  ON public.deal_pipeline
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.connection_requests cr
      WHERE cr.id = deal_pipeline.connection_request_id
        AND cr.user_id = auth.uid()
    )
  );

-- 2. Assigned owners can update their own deals
-- This future-proofs for a "team member" role that isn't full admin.
-- Currently all pipeline users are admins so this is additive, not restrictive.
CREATE POLICY "Deal owners can update own deals"
  ON public.deal_pipeline
  FOR UPDATE
  USING (
    deal_pipeline.assigned_to = auth.uid()
  )
  WITH CHECK (
    deal_pipeline.assigned_to = auth.uid()
  );

-- 3. Ensure deal_pipeline_stage_log is also accessible to deal owners
CREATE POLICY "Deal owners can view own stage log"
  ON public.deal_pipeline_stage_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deal_pipeline dp
      WHERE dp.id = deal_pipeline_stage_log.deal_id
        AND (dp.assigned_to = auth.uid() OR public.is_admin(auth.uid()))
    )
  );
