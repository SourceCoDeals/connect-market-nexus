-- Fix: Create missing deals for orphaned connection requests
-- There are 3 connection requests from Oct 6 that don't have deals
-- This might happen if the trigger was disabled or failed

-- First, let's check if the trigger exists and is enabled
DO $$
BEGIN
  -- Create deals for orphaned connection requests
  INSERT INTO deals (
    listing_id,
    stage_id,
    connection_request_id,
    value,
    probability,
    source,
    title,
    contact_name,
    contact_email,
    contact_company,
    contact_phone,
    contact_role,
    buyer_priority_score,
    nda_status,
    fee_agreement_status,
    created_at,
    stage_entered_at,
    metadata
  )
  SELECT 
    cr.listing_id,
    (SELECT id FROM deal_stages WHERE name = 'New Inquiry' LIMIT 1),
    cr.id,
    0,
    5,
    cr.source,
    COALESCE(
      cr.lead_name || ' - ' || (SELECT title FROM listings WHERE id = cr.listing_id),
      'New Deal'
    ),
    COALESCE(cr.lead_name, 'Unknown Contact'),
    cr.lead_email,
    cr.lead_company,
    cr.lead_phone,
    cr.lead_role,
    COALESCE(cr.buyer_priority_score, 0),
    CASE 
      WHEN cr.lead_nda_signed THEN 'signed'
      WHEN cr.lead_nda_email_sent THEN 'sent' 
      ELSE 'not_sent' 
    END,
    CASE 
      WHEN cr.lead_fee_agreement_signed THEN 'signed'
      WHEN cr.lead_fee_agreement_email_sent THEN 'sent' 
      ELSE 'not_sent' 
    END,
    cr.created_at,
    cr.created_at,
    jsonb_build_object(
      'auto_created', false,
      'manually_backfilled', true,
      'backfill_reason', 'Missing deals for connection requests',
      'backfill_date', NOW()
    )
  FROM connection_requests cr
  LEFT JOIN deals d ON d.connection_request_id = cr.id AND d.deleted_at IS NULL
  WHERE d.id IS NULL;
  
  RAISE NOTICE 'Backfilled % missing deals', (SELECT COUNT(*) FROM connection_requests cr LEFT JOIN deals d ON d.connection_request_id = cr.id AND d.deleted_at IS NULL WHERE d.id IS NULL);
END $$;