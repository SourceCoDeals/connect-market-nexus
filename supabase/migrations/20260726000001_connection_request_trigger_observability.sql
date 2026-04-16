-- ============================================================================
-- Observability on auto_create_deal_from_approved_connection
--
-- The connection-request approval flow has been patched four times in the last
-- two months (e8366c6 / 2cfa43b / 6203c6c / ca92032) because the trigger body
-- hits schema-drift issues that only surface at runtime — e.g. stale column
-- references or null approved_by. When it raises, the UPDATE rolls back and
-- the admin sees a toast, but there's no durable tail of *what* failed across
-- the team, so the same regression can reappear after a schema change and
-- spend days looking like flaky UI.
--
-- Wire the trigger body through an EXCEPTION block that calls
-- log_trigger_error() (added in 20260724000000_cto_audit_remediation) and
-- then RAISEs again. The log is admin-readable, auto-trimmed to 7 days, and
-- cheap to write. The re-raise preserves the current fail-loud semantics —
-- we never want to silently approve without creating a deal.
-- ============================================================================

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
EXCEPTION WHEN OTHERS THEN
  -- Durable tail so repeat failures are diagnosable. Fire-and-forget —
  -- log_trigger_error swallows its own errors so we never mask the original.
  PERFORM public.log_trigger_error(
    'auto_create_deal_from_approved_connection',
    'connection_requests',
    NEW.id::text,
    SQLSTATE,
    SQLERRM,
    jsonb_build_object(
      'listing_id', NEW.listing_id,
      'user_id', NEW.user_id,
      'approved_by', NEW.approved_by,
      'lead_email', NEW.lead_email,
      'old_status', OLD.status,
      'new_status', NEW.status
    )
  );
  -- Re-raise: keep the existing fail-loud semantics. Admin still sees the
  -- toast; we just also have a queryable record now.
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.auto_create_deal_from_approved_connection() IS
  'CANONICAL deal creation path for marketplace connection requests. '
  'Wraps the trigger body in log_trigger_error + re-raise so repeat '
  'regressions (schema drift, null approved_by, etc.) leave a durable audit '
  'trail in trigger_error_log. Rewritten 20260721, observability added 20260726.';
