-- Fix two critical blockers on the admin Accept / Decline / On Hold flow
-- for connection_requests that were not covered by 20260721000000_*.
--
-- ─────────────────────────────────────────────────────────────────────
-- BUG 1: Wrong status-transition state machine blocks every Accept click
-- ─────────────────────────────────────────────────────────────────────
-- Migration 20260525000000_platform_audit_remediation.sql created a BEFORE
-- UPDATE trigger `trg_connection_request_status_transition` that enforces
-- this state machine:
--
--   pending   → {notified, reviewed, rejected}
--   notified  → {reviewed, converted, rejected}
--   reviewed  → {converted, rejected}
--   converted → {}
--   rejected  → {}
--
-- But the current application (and the CHECK constraint added in
-- 20260314000002_fix_connection_request_status_constraint.sql) uses:
--
--   pending, approved, rejected, on_hold
--
-- The `notified / reviewed / converted` values are legacy dead status
-- values that the UI defensively maps away (see
-- `ConnectionRequestRow.tsx:727,746` and `WebflowLeadDetail.tsx:44`).
--
-- Result: every admin Accept click raises "Invalid status transition from
-- pending to approved", and every On Hold click raises "Invalid status
-- transition from pending to on_hold". Decline happens to work because
-- `pending → rejected` is allowed under both state machines.
--
-- The CHECK constraint already enforces validity of the status value
-- itself, and `trg_guard_status_change` (20260701000021) already enforces
-- that only admins can touch the column, so this state-machine trigger is
-- both wrong and redundant. Drop it.
DROP TRIGGER IF EXISTS trg_connection_request_status_transition
  ON public.connection_requests;
DROP FUNCTION IF EXISTS public.enforce_connection_request_status_transition();

-- ─────────────────────────────────────────────────────────────────────
-- BUG 2: auto_create_deal_from_approved_connection references columns
--         that were dropped
-- ─────────────────────────────────────────────────────────────────────
-- Migration 20260506200000_drop_deal_pipeline_duplicate_columns.sql dropped
-- these columns from deal_pipeline:
--
--   contact_name, contact_email, contact_company, contact_phone, contact_role,
--   contact_title, company_address
--
-- Then 17 days later, 20260523000001_high_severity_fixes.sql created
-- `auto_create_deal_from_approved_connection()` with a SELECT that filters
-- on `contact_email = NEW.lead_email` and an INSERT that sets
-- contact_name / contact_email / contact_company / contact_phone /
-- contact_role. Those column references are stale and fail at runtime.
--
-- Meanwhile 20260701000000_cleanup_orphaned_deal_functions.sql dropped the
-- alternative `create_deal_on_request_approval()` path, leaving this broken
-- function as the ONLY deal-creation trigger on connection_requests
-- (attached as `trg_auto_create_deal_from_connection`).
--
-- Symptoms: every successful Accept click (i.e. after Bug 1 is fixed)
-- raises "column contact_email of relation deal_pipeline does not exist"
-- from the AFTER UPDATE trigger, aborting the approval.
--
-- Rewrite the function to:
--   * Dedupe on `connection_request_id = NEW.id` (matches the comment in
--     20260701000000 and works for lead-only requests where lead_email
--     may be null).
--   * Not insert into the dropped contact_* columns. Modern contact info
--     lives on `connection_requests.lead_*` and on `contacts` via
--     `buyer_contact_id`; `get_deals_with_buyer_profiles()` already joins
--     those for the UI.
--   * Build a sensible title from the authenticated buyer's profile name
--     when available, falling back to lead fields.
--   * Resolve buyer_contact_id and seller_contact_id from the contacts
--     table, matching what `create_pipeline_deal()` RPC does.
--   * Use the `is_default` flag on deal_stages to find the default stage
--     (consistent with the dropped `create_deal_on_request_approval()`
--     path and the pipeline deep-dive fixes from 20260626000000).
--   * Use `NEW.approved_by` as `assigned_to` for parity with the old
--     `create_deal_on_request_approval()` path.

CREATE OR REPLACE FUNCTION public.auto_create_deal_from_approved_connection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_deal_id     uuid;
  v_default_stage_id     uuid;
  v_buyer_contact_id     uuid;
  v_seller_contact_id    uuid;
  v_remarketing_buyer_id uuid;
  v_contact_name         text;
  v_listing_title        text;
  v_deal_title           text;
  v_nda_status           text;
  v_fee_status           text;
  v_source               text;
BEGIN
  -- Only fire on transition INTO 'approved'.
  IF NEW.status <> 'approved' OR COALESCE(OLD.status, '') = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Dedupe on connection_request_id so we never create a second deal for
  -- the same approval, regardless of which code path (trigger or RPC)
  -- got there first.
  SELECT id
    INTO v_existing_deal_id
    FROM public.deal_pipeline
   WHERE connection_request_id = NEW.id
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_existing_deal_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve default stage: prefer the explicit is_default flag, fall back
  -- to the first active stage by position.
  SELECT id
    INTO v_default_stage_id
    FROM public.deal_stages
   WHERE is_active = true AND is_default = true
   LIMIT 1;

  IF v_default_stage_id IS NULL THEN
    SELECT id
      INTO v_default_stage_id
      FROM public.deal_stages
     WHERE is_active = true
     ORDER BY position ASC
     LIMIT 1;
  END IF;

  IF v_default_stage_id IS NULL THEN
    RAISE EXCEPTION
      'auto_create_deal_from_approved_connection: no active deal_stages found';
  END IF;

  -- Resolve buyer contact + remarketing buyer (only for authenticated buyers).
  IF NEW.user_id IS NOT NULL THEN
    SELECT c.id, c.remarketing_buyer_id
      INTO v_buyer_contact_id, v_remarketing_buyer_id
      FROM public.contacts c
     WHERE c.profile_id = NEW.user_id
       AND c.contact_type = 'buyer'
       AND c.archived = false
     LIMIT 1;
  END IF;

  -- Resolve primary seller contact from the listing.
  IF NEW.listing_id IS NOT NULL THEN
    SELECT c.id
      INTO v_seller_contact_id
      FROM public.contacts c
     WHERE c.listing_id = NEW.listing_id
       AND c.contact_type = 'seller'
       AND c.is_primary_seller_contact = true
       AND c.archived = false
     LIMIT 1;
  END IF;

  -- Build a title: prefer authenticated profile name, fall back to lead
  -- fields, fall back to 'Unknown'.
  IF NEW.user_id IS NOT NULL THEN
    SELECT COALESCE(
             NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
             p.email
           )
      INTO v_contact_name
      FROM public.profiles p
     WHERE p.id = NEW.user_id;
  END IF;

  v_contact_name := COALESCE(v_contact_name, NEW.lead_name, NEW.lead_email, 'Unknown');

  SELECT l.title
    INTO v_listing_title
    FROM public.listings l
   WHERE l.id = NEW.listing_id;

  v_deal_title := v_contact_name || ' - ' || COALESCE(v_listing_title, 'Unknown Listing');

  -- Derive NDA / fee-agreement statuses from the lead columns (these are
  -- used for both authenticated and lead-only paths because the admin may
  -- track signatures on the connection_request itself before the deal is
  -- created).
  v_nda_status := CASE
    WHEN COALESCE(NEW.lead_nda_signed,     false) THEN 'signed'
    WHEN COALESCE(NEW.lead_nda_email_sent, false) THEN 'sent'
    ELSE 'not_sent'
  END;

  v_fee_status := CASE
    WHEN COALESCE(NEW.lead_fee_agreement_signed,     false) THEN 'signed'
    WHEN COALESCE(NEW.lead_fee_agreement_email_sent, false) THEN 'sent'
    ELSE 'not_sent'
  END;

  v_source := COALESCE(NEW.source, 'marketplace');

  INSERT INTO public.deal_pipeline (
    listing_id,
    stage_id,
    connection_request_id,
    buyer_contact_id,
    seller_contact_id,
    remarketing_buyer_id,
    value,
    probability,
    assigned_to,
    stage_entered_at,
    source,
    nda_status,
    fee_agreement_status,
    title,
    description,
    priority
  )
  VALUES (
    NEW.listing_id,
    v_default_stage_id,
    NEW.id,
    v_buyer_contact_id,
    v_seller_contact_id,
    v_remarketing_buyer_id,
    0,
    10,
    NEW.approved_by,
    now(),
    v_source,
    v_nda_status,
    v_fee_status,
    v_deal_title,
    COALESCE(NEW.user_message, 'Deal created from approved connection request'),
    'medium'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_create_deal_from_approved_connection() IS
  'CANONICAL deal creation path for marketplace connection requests. '
  'Fires via trigger trg_auto_create_deal_from_connection (AFTER UPDATE '
  'on connection_requests) when status transitions to ''approved''. '
  'Deduplicates on connection_request_id. Rewritten 20260721 to drop stale '
  'references to deal_pipeline.contact_* columns (dropped in 20260506200000).';
