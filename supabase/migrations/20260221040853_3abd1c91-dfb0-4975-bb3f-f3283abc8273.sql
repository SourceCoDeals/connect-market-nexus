
-- Fix 1: Update score_snapshots tier check to include 'F' tier
ALTER TABLE public.score_snapshots DROP CONSTRAINT score_snapshots_tier_check;
ALTER TABLE public.score_snapshots ADD CONSTRAINT score_snapshots_tier_check 
  CHECK (tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'F'::text]));

-- Fix 2: Fix get_deal_access_matrix - replace p.full_name with CONCAT(p.first_name, ' ', p.last_name)
CREATE OR REPLACE FUNCTION public.get_deal_access_matrix(p_deal_id UUID)
RETURNS TABLE (
  access_id UUID,
  remarketing_buyer_id UUID,
  marketplace_user_id UUID,
  buyer_name TEXT,
  buyer_company TEXT,
  can_view_teaser BOOLEAN,
  can_view_full_memo BOOLEAN,
  can_view_data_room BOOLEAN,
  fee_agreement_signed BOOLEAN,
  fee_agreement_override BOOLEAN,
  fee_agreement_override_reason TEXT,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS access_id,
    a.remarketing_buyer_id,
    a.marketplace_user_id,
    COALESCE(rb.company_name, TRIM(CONCAT(p.first_name, ' ', p.last_name)), p.email) AS buyer_name,
    COALESCE(rb.pe_firm_name, rb.company_name) AS buyer_company,
    a.can_view_teaser,
    a.can_view_full_memo,
    a.can_view_data_room,
    COALESCE(
      (SELECT fa.fee_agreement_signed FROM public.firm_agreements fa
       WHERE fa.website_domain = rb.company_website
         OR fa.email_domain = rb.email_domain
       LIMIT 1),
      false
    ) AS fee_agreement_signed,
    a.fee_agreement_override,
    a.fee_agreement_override_reason,
    a.granted_at,
    a.revoked_at,
    a.expires_at,
    (SELECT MAX(al.created_at) FROM public.data_room_audit_log al
     WHERE al.deal_id = a.deal_id
       AND al.user_id = COALESCE(a.marketplace_user_id, a.remarketing_buyer_id::uuid)
       AND al.action IN ('view_document', 'download_document', 'view_data_room')
    ) AS last_access_at
  FROM public.data_room_access a
  LEFT JOIN public.remarketing_buyers rb ON rb.id = a.remarketing_buyer_id
  LEFT JOIN public.profiles p ON p.id = a.marketplace_user_id
  WHERE a.deal_id = p_deal_id
  ORDER BY a.granted_at DESC;
$$;

-- Fix 3: Fix get_deal_distribution_log - same full_name issue
CREATE OR REPLACE FUNCTION public.get_deal_distribution_log(p_deal_id UUID)
RETURNS TABLE (
  log_id UUID,
  buyer_name TEXT,
  buyer_company TEXT,
  memo_type TEXT,
  channel TEXT,
  sent_by_name TEXT,
  sent_at TIMESTAMPTZ,
  email_address TEXT,
  notes TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dl.id AS log_id,
    COALESCE(rb.company_name, TRIM(CONCAT(p.first_name, ' ', p.last_name)), p.email) AS buyer_name,
    COALESCE(rb.pe_firm_name, rb.company_name) AS buyer_company,
    dl.memo_type,
    dl.channel,
    TRIM(CONCAT(sp.first_name, ' ', sp.last_name)) AS sent_by_name,
    dl.sent_at,
    dl.email_address,
    dl.notes
  FROM public.memo_distribution_log dl
  LEFT JOIN public.remarketing_buyers rb ON rb.id = dl.remarketing_buyer_id
  LEFT JOIN public.profiles p ON p.id = dl.marketplace_user_id
  LEFT JOIN public.profiles sp ON sp.id = dl.sent_by
  WHERE dl.deal_id = p_deal_id
  ORDER BY dl.sent_at DESC;
$$;

-- Fix 4: Mark permanently-failed enrichments (invalid URLs) as completed-with-error so they don't block
UPDATE enrichment_queue 
SET status = 'completed', last_error = 'Permanently failed: ' || last_error
WHERE status = 'failed' 
  AND last_error LIKE '%Invalid URL%';
