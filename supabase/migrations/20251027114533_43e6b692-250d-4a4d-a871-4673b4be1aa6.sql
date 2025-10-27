-- ============================================================================
-- FIRM AGREEMENTS EXTENSION - Part 5: Backfill existing data
-- ============================================================================

-- Backfill inbound_leads with firm_id
UPDATE public.inbound_leads l
SET firm_id = (
  SELECT f.id
  FROM public.firm_agreements f
  WHERE (f.normalized_company_name = normalize_company_name(l.company_name) AND l.company_name IS NOT NULL)
     OR (f.email_domain = extract_domain(l.email) AND l.email IS NOT NULL 
         AND extract_domain(l.email) NOT IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com'))
  ORDER BY f.created_at DESC
  LIMIT 1
)
WHERE firm_id IS NULL
  AND (email IS NOT NULL OR company_name IS NOT NULL);

-- Backfill connection_requests with firm_id
UPDATE public.connection_requests cr
SET firm_id = (
  CASE 
    -- Has user_id, get from firm_members
    WHEN cr.user_id IS NOT NULL THEN (
      SELECT fm.firm_id
      FROM public.firm_members fm
      WHERE fm.user_id = cr.user_id
      LIMIT 1
    )
    -- Has source_lead_id, get from inbound_leads
    WHEN cr.source_lead_id IS NOT NULL THEN (
      SELECT il.firm_id
      FROM public.inbound_leads il
      WHERE il.id = cr.source_lead_id
    )
    -- Manual lead, match by company/email
    WHEN cr.lead_email IS NOT NULL OR cr.lead_company IS NOT NULL THEN (
      SELECT f.id
      FROM public.firm_agreements f
      WHERE (f.normalized_company_name = normalize_company_name(cr.lead_company) AND cr.lead_company IS NOT NULL)
         OR (f.email_domain = extract_domain(cr.lead_email) AND cr.lead_email IS NOT NULL
             AND extract_domain(cr.lead_email) NOT IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com'))
      ORDER BY f.created_at DESC
      LIMIT 1
    )
  END
)
WHERE firm_id IS NULL;

-- Sync agreement status from firms to connection requests (most permissive rule)
UPDATE public.connection_requests cr
SET 
  lead_fee_agreement_signed = CASE 
    WHEN f.fee_agreement_signed OR COALESCE(cr.lead_fee_agreement_signed, FALSE) THEN TRUE 
    ELSE FALSE 
  END,
  lead_fee_agreement_signed_at = CASE 
    WHEN f.fee_agreement_signed AND NOT COALESCE(cr.lead_fee_agreement_signed, FALSE) THEN f.fee_agreement_signed_at
    ELSE cr.lead_fee_agreement_signed_at
  END,
  lead_nda_signed = CASE 
    WHEN f.nda_signed OR COALESCE(cr.lead_nda_signed, FALSE) THEN TRUE 
    ELSE FALSE 
  END,
  lead_nda_signed_at = CASE 
    WHEN f.nda_signed AND NOT COALESCE(cr.lead_nda_signed, FALSE) THEN f.nda_signed_at
    ELSE cr.lead_nda_signed_at
  END,
  updated_at = NOW()
FROM public.firm_agreements f
WHERE cr.firm_id = f.id
  AND cr.user_id IS NULL
  AND (
    (f.fee_agreement_signed AND NOT COALESCE(cr.lead_fee_agreement_signed, FALSE))
    OR (f.nda_signed AND NOT COALESCE(cr.lead_nda_signed, FALSE))
  );