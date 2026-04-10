-- G7 FIX: Update deal_pipeline.last_activity_at when a comment is added.
-- The stale-deal detection checks last_activity_at, but deal_comments
-- (Notes tab) is a separate table from deal_activities (History tab).
-- Without this trigger, deals with weekly check-in notes still show as "stuck."

CREATE OR REPLACE FUNCTION public.update_deal_activity_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.deal_pipeline
  SET last_activity_at = now(),
      updated_at = now()
  WHERE id = NEW.deal_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_deal_activity_on_comment ON public.deal_comments;
CREATE TRIGGER trg_update_deal_activity_on_comment
  AFTER INSERT ON public.deal_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deal_activity_on_comment();

-- G11 FIX: Add intro_response_status to deal_pipeline for owner intro tracking.
-- When Jess requests an intro from the seller, she needs to track whether the
-- seller accepted, declined, or hasn't responded yet.
ALTER TABLE public.deal_pipeline
  ADD COLUMN IF NOT EXISTS intro_response_status TEXT DEFAULT 'pending'
    CHECK (intro_response_status IN ('pending', 'accepted', 'declined', 'no_response'));

ALTER TABLE public.deal_pipeline
  ADD COLUMN IF NOT EXISTS intro_response_at TIMESTAMPTZ;

COMMENT ON COLUMN public.deal_pipeline.intro_response_status IS
  'Seller response to the buyer introduction: pending, accepted, declined, no_response';

-- G12 FIX: Add call_outcome to deal_pipeline for structured call result tracking.
-- After an intro call, Jess needs to record whether the buyer wants to proceed,
-- needs more info, or is passing — as a filterable field, not buried in notes.
ALTER TABLE public.deal_pipeline
  ADD COLUMN IF NOT EXISTS call_outcome TEXT
    CHECK (call_outcome IS NULL OR call_outcome IN (
      'proceed_to_dd', 'needs_more_info', 'scheduling_followup',
      'buyer_passed', 'seller_passed', 'mutual_pass'
    ));

ALTER TABLE public.deal_pipeline
  ADD COLUMN IF NOT EXISTS call_outcome_at TIMESTAMPTZ;

COMMENT ON COLUMN public.deal_pipeline.call_outcome IS
  'Structured outcome of the buyer/seller intro call. Filterable and reportable.';
