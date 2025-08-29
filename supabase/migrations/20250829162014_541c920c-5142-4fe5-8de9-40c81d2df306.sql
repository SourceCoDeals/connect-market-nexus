-- Create trigger to auto-create a Deal when a connection request is approved
CREATE OR REPLACE FUNCTION public.create_deal_on_request_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_deal_id uuid;
  qualified_stage_id uuid;
  buyer_name text;
  buyer_email text;
  buyer_company text;
  buyer_phone text;
  buyer_role text;
  nda_status text := 'not_sent';
  fee_status text := 'not_sent';
  src text;
  deal_title text;
  new_deal_id uuid;
BEGIN
  -- Only proceed when status transitions to approved
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND COALESCE(OLD.status,'') <> 'approved' THEN
    -- Avoid duplicates
    SELECT id INTO existing_deal_id FROM public.deals WHERE connection_request_id = NEW.id LIMIT 1;
    IF existing_deal_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    -- Find qualified stage id
    SELECT id INTO qualified_stage_id FROM public.deal_stages
      WHERE is_active = true AND name = 'Qualified'
      ORDER BY position
      LIMIT 1;

    -- Fallback to first active stage
    IF qualified_stage_id IS NULL THEN
      SELECT id INTO qualified_stage_id FROM public.deal_stages WHERE is_active = true ORDER BY position LIMIT 1;
    END IF;

    -- Determine contact info
    SELECT COALESCE(NEW.lead_name, p.first_name || ' ' || p.last_name),
           COALESCE(NEW.lead_email, p.email),
           COALESCE(NEW.lead_company, p.company),
           COALESCE(NEW.lead_phone, p.phone_number),
           COALESCE(NEW.lead_role, p.job_title)
    INTO buyer_name, buyer_email, buyer_company, buyer_phone, buyer_role
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

    -- NDA/Fee statuses
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

    -- Deal title from listing
    SELECT COALESCE(l.title, 'Unknown') INTO deal_title FROM public.listings l WHERE l.id = NEW.listing_id;

    -- Insert deal
    INSERT INTO public.deals (
      listing_id, stage_id, connection_request_id, value, probability, expected_close_date,
      assigned_to, stage_entered_at, source,
      contact_name, contact_email, contact_company, contact_phone, contact_role,
      nda_status, fee_agreement_status, title, description, priority
    )
    VALUES (
      NEW.listing_id, qualified_stage_id, NEW.id, 0, 50, NULL,
      NEW.approved_by, now(), src,
      buyer_name, buyer_email, buyer_company, buyer_phone, buyer_role,
      nda_status, fee_status,
      deal_title,
      COALESCE(NEW.user_message, 'Deal created from approved connection request'),
      'medium'
    )
    RETURNING id INTO new_deal_id;

    -- Insert an activity note with the initial user message
    IF new_deal_id IS NOT NULL THEN
      INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
      VALUES (
        new_deal_id,
        NEW.approved_by,
        'note',
        'Created from connection request',
        COALESCE(NEW.user_message, 'Approved connection request and created deal'),
        jsonb_build_object('connection_request_id', NEW.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_deal_on_request_approval ON public.connection_requests;
CREATE TRIGGER trg_create_deal_on_request_approval
AFTER UPDATE ON public.connection_requests
FOR EACH ROW
EXECUTE FUNCTION public.create_deal_on_request_approval();

-- One-time backfill: create deals for already approved requests without a deal
WITH qualified_stage AS (
  SELECT id FROM public.deal_stages WHERE is_active = true AND name = 'Qualified' ORDER BY position LIMIT 1
)
INSERT INTO public.deals (
  listing_id, stage_id, connection_request_id, value, probability, expected_close_date,
  assigned_to, stage_entered_at, source,
  contact_name, contact_email, contact_company, contact_phone, contact_role,
  nda_status, fee_agreement_status, title, description, priority
)
SELECT 
  cr.listing_id,
  COALESCE((SELECT id FROM qualified_stage), (SELECT id FROM public.deal_stages WHERE is_active = true ORDER BY position LIMIT 1)),
  cr.id,
  0,
  50,
  NULL,
  cr.approved_by,
  NOW(),
  COALESCE(cr.source, 'marketplace'),
  COALESCE(cr.lead_name, p.first_name || ' ' || p.last_name),
  COALESCE(cr.lead_email, p.email),
  COALESCE(cr.lead_company, p.company),
  COALESCE(cr.lead_phone, p.phone_number),
  COALESCE(cr.lead_role, p.job_title),
  CASE WHEN COALESCE(cr.lead_nda_signed, false) THEN 'signed' WHEN COALESCE(cr.lead_nda_email_sent, false) THEN 'sent' ELSE 'not_sent' END,
  CASE WHEN COALESCE(cr.lead_fee_agreement_signed, false) THEN 'signed' WHEN COALESCE(cr.lead_fee_agreement_email_sent, false) THEN 'sent' ELSE 'not_sent' END,
  (SELECT COALESCE(l.title, 'Unknown') FROM public.listings l WHERE l.id = cr.listing_id),
  COALESCE(cr.user_message, 'Deal created from approved connection request'),
  'medium'
FROM public.connection_requests cr
LEFT JOIN public.deals d ON d.connection_request_id = cr.id
LEFT JOIN public.profiles p ON p.id = cr.user_id
WHERE cr.status = 'approved' AND d.id IS NULL;