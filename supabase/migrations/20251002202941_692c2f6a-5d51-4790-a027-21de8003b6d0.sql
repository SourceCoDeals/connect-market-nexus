-- Complete fix with proper source mapping
-- Step 1: Move stages to avoid conflicts
UPDATE public.deal_stages SET position = position + 3000;

-- Step 2: Add missing stages
INSERT INTO public.deal_stages (name, description, position, color, stage_type, default_probability, is_active, is_default)
SELECT 'NDA + Agreement Sent', 'NDA and Fee Agreement sent', 4003, '#8b5cf6', 'active', 35, true, false
WHERE NOT EXISTS (SELECT 1 FROM public.deal_stages WHERE name = 'NDA + Agreement Sent');

INSERT INTO public.deal_stages (name, description, position, color, stage_type, default_probability, is_active, is_default)
SELECT 'Negotiation', 'Active negotiation phase', 4007, '#f59e0b', 'active', 75, true, false
WHERE NOT EXISTS (SELECT 1 FROM public.deal_stages WHERE name = 'Negotiation');

-- Step 3: Set correct positions and probabilities
UPDATE public.deal_stages SET position = 0, default_probability = 5 WHERE name = 'New Inquiry';
UPDATE public.deal_stages SET position = 1, default_probability = 15 WHERE name = 'Initial Review';
UPDATE public.deal_stages SET position = 2, default_probability = 25 WHERE name = 'Approved';
UPDATE public.deal_stages SET position = 3, default_probability = 35 WHERE name = 'NDA + Agreement Sent';
UPDATE public.deal_stages SET position = 4, default_probability = 45 WHERE name = 'Info Sent';
UPDATE public.deal_stages SET position = 5, default_probability = 55 WHERE name = 'Buyer/Seller Call';
UPDATE public.deal_stages SET position = 6, default_probability = 65 WHERE name = 'Due Diligence';
UPDATE public.deal_stages SET position = 7, default_probability = 75 WHERE name = 'Negotiation';
UPDATE public.deal_stages SET position = 8, default_probability = 85 WHERE name = 'LOI Submitted';
UPDATE public.deal_stages SET position = 9, default_probability = 95 WHERE name = 'Under Contract';
UPDATE public.deal_stages SET position = 10, default_probability = 100 WHERE name = 'Closed Won';
UPDATE public.deal_stages SET position = 11, default_probability = 0 WHERE name = 'Closed Lost';

-- Step 4: Backfill with proper source mapping (website -> webflow, anything else -> marketplace)
INSERT INTO public.deals (
  listing_id, stage_id, connection_request_id, value, probability, 
  source, title, contact_name, contact_email, nda_status, 
  fee_agreement_status, created_at, stage_entered_at, metadata
)
SELECT 
  cr.listing_id,
  (SELECT id FROM public.deal_stages WHERE name = 'New Inquiry' LIMIT 1),
  cr.id,
  0,
  5,
  CASE 
    WHEN cr.source = 'website' THEN 'webflow'
    WHEN cr.source IN ('marketplace', 'webflow', 'manual') THEN cr.source
    ELSE 'marketplace'
  END,
  'Backfilled Deal',
  COALESCE(cr.lead_name, 'Unknown'),
  cr.lead_email,
  CASE WHEN cr.lead_nda_signed THEN 'signed' WHEN cr.lead_nda_email_sent THEN 'sent' ELSE 'not_sent' END,
  CASE WHEN cr.lead_fee_agreement_signed THEN 'signed' WHEN cr.lead_fee_agreement_email_sent THEN 'sent' ELSE 'not_sent' END,
  cr.created_at,
  cr.created_at,
  jsonb_build_object('backfilled', true, 'backfill_date', NOW(), 'original_source', cr.source)
FROM public.connection_requests cr
WHERE NOT EXISTS (
  SELECT 1 FROM public.deals d 
  WHERE d.connection_request_id = cr.id AND d.deleted_at IS NULL
);