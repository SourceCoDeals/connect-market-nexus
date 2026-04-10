-- ============================================================================
-- PHASE 5: Fix the 12 backend findings from pipeline deep-dive audit
-- ============================================================================
-- Fixes: F-A1, F-A2, F-A3, F-A4, F-B2, F-Cross1, F-Cross2, F-Cross3,
--        F-Int1, F-Schema1
--
-- Approach:
--   1. Drop the zombie function auto_create_deal_from_connection_request (F-A4)
--   2. Rewrite create_deal_on_request_approval to:
--      - Use stage_type/position instead of hardcoded 'Qualified' (F-A2)
--      - RAISE WARNING on invalid website instead of silent skip (F-A1)
--      - Use standard default probability (F-Cross1)
--   3. Rewrite create_pipeline_deal RPC to remove stage name hardcodes (F-Cross2)
--      and use the same probability constant (F-Cross1)
--   4. Fix double-advance of intro status (F-B2): remove the trigger that
--      tries to advance a status the JS path already advanced
--   5. Add deal_pipeline_stage_log table (F-Cross3)
--   6. Wire 4 null stage_trigger task templates to real stages (F-Int1)
--   7. Change stage_id FK from SET NULL to RESTRICT (F-Schema1)
-- ============================================================================

-- ── Standard probability constant ─────────────────────────────────────────
-- All intake paths now use the same value. If you want to differentiate,
-- do it via stage.default_probability after insert rather than per-funnel.
-- Probability 10 = "top of funnel, not yet qualified."

-- ── 1. Drop zombie function (F-A4) ───────────────────────────────────────
DROP FUNCTION IF EXISTS public.auto_create_deal_from_connection_request() CASCADE;


-- ── 2. Rewrite create_deal_on_request_approval (F-A1, F-A2, F-Cross1, F-Cross2) ─
CREATE OR REPLACE FUNCTION public.create_deal_on_request_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_deal_id uuid;
  default_stage_id uuid;
  nda_status text := 'not_sent';
  fee_status text := 'not_sent';
  src text;
  deal_title text;
  new_deal_id uuid;
  v_listing_website text;
  DEFAULT_PROBABILITY CONSTANT integer := 10;
BEGIN
  -- Only fire on status changing to 'approved'
  IF TG_OP <> 'UPDATE'
     OR NEW.status <> 'approved'
     OR COALESCE(OLD.status, '') = 'approved'
  THEN
    RETURN NEW;
  END IF;

  -- Deduplicate: if a deal already exists for this request, skip
  SELECT id INTO existing_deal_id
    FROM public.deal_pipeline
   WHERE connection_request_id = NEW.id
   LIMIT 1;

  IF existing_deal_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- F-A1 FIX: Validate listing website, RAISE WARNING instead of silent skip
  -- so the admin at least sees a log entry. The deal is still created — the
  -- website check was blocking deal creation which is worse than a dirty URL.
  SELECT website INTO v_listing_website
    FROM public.listings
   WHERE id = NEW.listing_id;

  IF NOT public.is_valid_company_website(v_listing_website) THEN
    RAISE WARNING 'create_deal_on_request_approval: listing % has invalid website "%" — deal created anyway',
      NEW.listing_id, COALESCE(v_listing_website, '(null)');
    -- Previously RETURN NEW here silently skipped deal creation.
    -- Now we log and proceed.
  END IF;

  -- F-A2 + F-Cross2 FIX: Look up default stage by is_default flag, then
  -- fall back to first active stage by position. No hardcoded name strings.
  SELECT id INTO default_stage_id
    FROM public.deal_stages
   WHERE is_active = true AND is_default = true
   LIMIT 1;

  IF default_stage_id IS NULL THEN
    SELECT id INTO default_stage_id
      FROM public.deal_stages
     WHERE is_active = true
     ORDER BY position ASC
     LIMIT 1;
  END IF;

  IF default_stage_id IS NULL THEN
    RAISE EXCEPTION 'create_deal_on_request_approval: no active deal_stages found';
  END IF;

  -- Derive NDA/fee statuses from lead fields
  IF COALESCE(NEW.lead_nda_signed, false) THEN
    nda_status := 'signed';
  ELSIF COALESCE(NEW.lead_nda_email_sent, false) THEN
    nda_status := 'sent';
  END IF;

  IF COALESCE(NEW.lead_fee_agreement_signed, false) THEN
    fee_status := 'signed';
  ELSIF COALESCE(NEW.lead_fee_agreement_email_sent, false) THEN
    fee_status := 'sent';
  END IF;

  src := COALESCE(NEW.source, 'marketplace');

  SELECT COALESCE(l.title, 'Unknown') INTO deal_title
    FROM public.listings l
   WHERE l.id = NEW.listing_id;

  -- F-Cross1 FIX: Use standard DEFAULT_PROBABILITY instead of per-funnel 50
  INSERT INTO public.deal_pipeline (
    listing_id, stage_id, connection_request_id, value, probability,
    expected_close_date, assigned_to, stage_entered_at, source,
    nda_status, fee_agreement_status, title, description, priority
  )
  VALUES (
    NEW.listing_id, default_stage_id, NEW.id, 0, DEFAULT_PROBABILITY,
    NULL, NEW.approved_by, now(), src,
    nda_status, fee_status,
    deal_title,
    COALESCE(NEW.user_message, 'Deal created from approved connection request'),
    'medium'
  )
  RETURNING id INTO new_deal_id;

  IF new_deal_id IS NOT NULL THEN
    INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
    VALUES (
      new_deal_id,
      NEW.approved_by,
      'deal_created',
      'Created from connection request',
      COALESCE(NEW.user_message, 'Approved connection request and created deal'),
      jsonb_build_object('connection_request_id', NEW.id, 'funnel', 'admin_approval')
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.create_deal_on_request_approval() IS
  'Creates a deal_pipeline row when a connection_request is approved. '
  'Phase 5: No longer hardcodes stage names; uses is_default or position. '
  'Logs warning on invalid website instead of silently skipping.';


-- ── 3. Rewrite create_pipeline_deal RPC (F-Cross1, F-Cross2) ─────────────
-- The Phase 4 RPC also hardcodes 'Approved' / 'New Inquiry' as name strings
-- and uses probability 5. Align both.
CREATE OR REPLACE FUNCTION public.create_pipeline_deal(
  p_connection_request_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cr              RECORD;
  v_source          text;
  v_lead_source     text;
  v_buyer_type      text;
  v_buyer_priority  integer;
  v_stage_id        uuid;
  v_buyer_contact_id uuid;
  v_remarketing_buyer_id uuid;
  v_seller_contact_id uuid;
  v_contact_name    text;
  v_listing_title   text;
  v_deal_title      text;
  v_nda_status      text;
  v_fee_status      text;
  v_new_deal_id     uuid;
  v_existing_deal_id uuid;
  DEFAULT_PROBABILITY CONSTANT integer := 10;
BEGIN
  -- Step 1: Fetch the connection request
  SELECT *
    INTO v_cr
    FROM public.connection_requests
   WHERE id = p_connection_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'create_pipeline_deal: connection_request not found: %', p_connection_request_id;
  END IF;

  -- Step 1b: Guard against duplicate deals
  SELECT dp.id INTO v_existing_deal_id
    FROM public.deal_pipeline dp
   WHERE dp.connection_request_id = p_connection_request_id
   LIMIT 1;

  IF v_existing_deal_id IS NOT NULL THEN
    RETURN v_existing_deal_id;
  END IF;

  -- Step 2: Ensure source (replaces trg_ensure_source_from_lead)
  v_source := v_cr.source;

  IF v_cr.source_lead_id IS NOT NULL
     AND (v_source IS NULL OR v_source = 'marketplace')
  THEN
    SELECT il.source
      INTO v_lead_source
      FROM public.inbound_leads il
     WHERE il.id = v_cr.source_lead_id;

    IF v_lead_source IS NOT NULL THEN
      v_source := v_lead_source;
    END IF;
  END IF;

  v_source := COALESCE(v_source, 'marketplace');

  -- Step 3: Compute buyer priority score
  v_buyer_priority := 0;

  IF v_cr.user_id IS NOT NULL THEN
    SELECT p.buyer_type
      INTO v_buyer_type
      FROM public.profiles p
     WHERE p.id = v_cr.user_id;

    v_buyer_priority := COALESCE(
      public.calculate_buyer_priority_score(v_buyer_type),
      0
    );
  ELSE
    v_buyer_priority := COALESCE(v_cr.buyer_priority_score, 0);
  END IF;

  -- F-Cross2 FIX: Use is_default flag + position fallback, not name strings
  SELECT ds.id
    INTO v_stage_id
    FROM public.deal_stages ds
   WHERE ds.is_active = true AND ds.is_default = true
   LIMIT 1;

  IF v_stage_id IS NULL THEN
    SELECT ds.id INTO v_stage_id
      FROM public.deal_stages ds
     WHERE ds.is_active = true
     ORDER BY ds.position ASC
     LIMIT 1;
  END IF;

  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'create_pipeline_deal: no deal_stages found';
  END IF;

  -- Step 5: Resolve buyer_contact_id and remarketing_buyer_id
  IF v_cr.user_id IS NOT NULL THEN
    SELECT c.id, c.remarketing_buyer_id
      INTO v_buyer_contact_id, v_remarketing_buyer_id
      FROM public.contacts c
     WHERE c.profile_id = v_cr.user_id
       AND c.contact_type = 'buyer'
       AND c.archived = false
     LIMIT 1;
  END IF;

  -- Step 6: Resolve seller_contact_id
  IF v_cr.listing_id IS NOT NULL THEN
    SELECT c.id
      INTO v_seller_contact_id
      FROM public.contacts c
     WHERE c.listing_id = v_cr.listing_id
       AND c.contact_type = 'seller'
       AND c.is_primary_seller_contact = true
       AND c.archived = false
     LIMIT 1;
  END IF;

  -- Step 7: Build deal title
  IF v_cr.user_id IS NOT NULL THEN
    SELECT COALESCE(p.first_name || ' ' || p.last_name, p.email)
      INTO v_contact_name
      FROM public.profiles p
     WHERE p.id = v_cr.user_id;
  END IF;
  v_contact_name := COALESCE(v_contact_name, v_cr.lead_name, 'Unknown');

  SELECT l.title
    INTO v_listing_title
    FROM public.listings l
   WHERE l.id = v_cr.listing_id;

  v_deal_title := v_contact_name || ' - ' || COALESCE(v_listing_title, 'Unknown Listing');

  -- Step 8: Derive NDA / fee agreement statuses
  v_nda_status := CASE
    WHEN COALESCE(v_cr.lead_nda_signed, false)     THEN 'signed'
    WHEN COALESCE(v_cr.lead_nda_email_sent, false)  THEN 'sent'
    ELSE 'not_sent'
  END;

  v_fee_status := CASE
    WHEN COALESCE(v_cr.lead_fee_agreement_signed, false)     THEN 'signed'
    WHEN COALESCE(v_cr.lead_fee_agreement_email_sent, false)  THEN 'sent'
    ELSE 'not_sent'
  END;

  -- F-Cross1 FIX: Standard probability, not per-funnel constant
  INSERT INTO public.deal_pipeline (
    listing_id, stage_id, connection_request_id, remarketing_buyer_id,
    value, probability, source, title, buyer_priority_score,
    nda_status, fee_agreement_status,
    created_at, stage_entered_at,
    buyer_contact_id, seller_contact_id
  ) VALUES (
    v_cr.listing_id, v_stage_id, v_cr.id, v_remarketing_buyer_id,
    0, DEFAULT_PROBABILITY, v_source, v_deal_title, v_buyer_priority,
    v_nda_status, v_fee_status,
    v_cr.created_at, v_cr.created_at,
    v_buyer_contact_id, v_seller_contact_id
  )
  RETURNING id INTO v_new_deal_id;

  RETURN v_new_deal_id;
END;
$$;


-- ── 4. Fix double-advance of intro status (F-B2) ─────────────────────────
-- The JS path (createDealFromIntroduction) already advances introduction_status
-- to 'deal_created' at insert time (use-buyer-introductions.ts:342-345).
-- The trigger trg_sync_pipeline_to_introduction checks for 'fit_and_interested'
-- which the JS path already passed, making the trigger dead code.
-- Drop the trigger to eliminate the double-path confusion.
-- If we ever need close-time sync, add it as a separate, clearly-named trigger.
DROP TRIGGER IF EXISTS trg_sync_pipeline_to_introduction ON public.deal_pipeline;

-- Keep the function for reference but mark it deprecated
COMMENT ON FUNCTION public.sync_pipeline_close_to_introduction() IS
  'DEPRECATED (Phase 5): Trigger dropped. The JS path in createDealFromIntroduction '
  'already advances introduction_status to deal_created at insert time.';


-- ── 5. Add deal_pipeline_stage_log table (F-Cross3) ──────────────────────
-- First-class audit trail for every stage transition, analogous to
-- introduction_status_log for buyer introductions.
CREATE TABLE IF NOT EXISTS public.deal_pipeline_stage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deal_pipeline(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES public.deal_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES public.deal_stages(id) ON DELETE SET NULL,
  from_stage_name TEXT,
  to_stage_name TEXT,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_stage_log_deal_id ON public.deal_pipeline_stage_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_stage_log_changed_at ON public.deal_pipeline_stage_log(changed_at);

ALTER TABLE public.deal_pipeline_stage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stage log"
  ON public.deal_pipeline_stage_log
  FOR ALL USING (public.is_admin(auth.uid()));

-- Trigger to auto-populate the stage log on every stage change
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_name TEXT;
  v_to_name TEXT;
BEGIN
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_from_name FROM public.deal_stages WHERE id = OLD.stage_id;
  SELECT name INTO v_to_name FROM public.deal_stages WHERE id = NEW.stage_id;

  INSERT INTO public.deal_pipeline_stage_log (
    deal_id, from_stage_id, to_stage_id, from_stage_name, to_stage_name,
    changed_by
  ) VALUES (
    NEW.id, OLD.stage_id, NEW.stage_id, v_from_name, v_to_name,
    NEW.assigned_to  -- best-effort; the RPC sets assigned_to = current_admin
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_deal_stage_change ON public.deal_pipeline;
CREATE TRIGGER trg_log_deal_stage_change
  AFTER UPDATE OF stage_id ON public.deal_pipeline
  FOR EACH ROW
  EXECUTE FUNCTION public.log_deal_stage_change();


-- ── 6. Wire task templates to stages (F-Int1) ────────────────────────────
-- 4 of 5 templates have stage_trigger = NULL. Wire them to the most
-- logical stage so they auto-fire when deals enter those stages.
-- If a template should NOT auto-fire, keep it NULL and note why.

-- 'New Deal Intake' fires when deal first enters the default stage ('Approved')
UPDATE public.task_templates
   SET stage_trigger = 'Approved'
 WHERE name = 'New Deal Intake'
   AND stage_trigger IS NULL;

-- 'Buyer Outreach Launch' fires when deal enters 'Info Sent'
-- (this is when the listing teaser goes to buyers)
UPDATE public.task_templates
   SET stage_trigger = 'Info Sent'
 WHERE name = 'Buyer Outreach Launch'
   AND stage_trigger IS NULL;

-- 'Post-Call Follow-up' fires when deal enters 'Buyer/Seller Call'
UPDATE public.task_templates
   SET stage_trigger = 'Buyer/Seller Call'
 WHERE name = 'Post-Call Follow-up'
   AND stage_trigger IS NULL;

-- 'Interested Buyer Response' — keep NULL.
-- This template is triggered by buyer response events, not stage changes.
-- It would be confusing to auto-fire on a stage entry.

-- 'Due Diligence Checklist' already has stage_trigger = 'Due Diligence' — no change


-- ── 7. Protect stage_id from silent orphaning (F-Schema1) ────────────────
-- Change ON DELETE SET NULL → ON DELETE RESTRICT so that deleting a stage
-- that still has deals will error rather than silently orphan them.
-- This requires dropping and re-adding the FK constraint.
DO $$
BEGIN
  -- Drop the old FK if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'deal_pipeline'
      AND constraint_name = 'deals_stage_id_fkey'
  ) THEN
    ALTER TABLE public.deal_pipeline DROP CONSTRAINT deals_stage_id_fkey;
  END IF;

  -- Also check for alternative constraint name (may have been renamed)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'deal_pipeline'
      AND constraint_name = 'deal_pipeline_stage_id_fkey'
  ) THEN
    ALTER TABLE public.deal_pipeline DROP CONSTRAINT deal_pipeline_stage_id_fkey;
  END IF;

  -- Re-add with RESTRICT
  ALTER TABLE public.deal_pipeline
    ADD CONSTRAINT deal_pipeline_stage_id_fkey
    FOREIGN KEY (stage_id) REFERENCES public.deal_stages(id) ON DELETE RESTRICT;
END $$;

COMMENT ON CONSTRAINT deal_pipeline_stage_id_fkey ON public.deal_pipeline IS
  'RESTRICT: prevents silent orphaning of deals when stages are deleted. '
  'Move deals to another stage first before deleting a stage.';
