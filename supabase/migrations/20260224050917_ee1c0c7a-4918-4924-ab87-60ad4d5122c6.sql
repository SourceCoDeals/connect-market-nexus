
-- Migration: deals_contact_fk_columns
-- Adds buyer_contact_id and seller_contact_id to deals with FK constraints and backfill

-- 1. Add columns
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS buyer_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_deals_buyer_contact ON public.deals(buyer_contact_id) WHERE buyer_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_seller_contact ON public.deals(seller_contact_id) WHERE seller_contact_id IS NOT NULL;

-- 3. Backfill seller_contact_id: match via listing_id + primary seller contact
UPDATE public.deals d
SET seller_contact_id = c.id
FROM public.contacts c
WHERE d.seller_contact_id IS NULL
  AND d.listing_id IS NOT NULL
  AND c.listing_id = d.listing_id
  AND c.contact_type = 'seller'
  AND c.is_primary_seller_contact = true
  AND c.archived = false;

-- 3b. Fallback: match seller by email
UPDATE public.deals d
SET seller_contact_id = c.id
FROM public.contacts c
WHERE d.seller_contact_id IS NULL
  AND d.contact_email IS NOT NULL
  AND d.contact_email != ''
  AND lower(c.email) = lower(d.contact_email)
  AND c.contact_type = 'seller'
  AND c.archived = false;

-- 4. Backfill buyer_contact_id: match via connection_request → profile → contact
UPDATE public.deals d
SET buyer_contact_id = c.id
FROM public.connection_requests cr
JOIN public.contacts c ON c.profile_id = cr.user_id AND c.contact_type = 'buyer' AND c.archived = false
WHERE d.buyer_contact_id IS NULL
  AND d.connection_request_id IS NOT NULL
  AND cr.id = d.connection_request_id;

-- 4b. Also derive remarketing_buyer_id from the matched buyer contact if not already set
UPDATE public.deals d
SET remarketing_buyer_id = c.remarketing_buyer_id
FROM public.contacts c
WHERE d.remarketing_buyer_id IS NULL
  AND d.buyer_contact_id IS NOT NULL
  AND c.id = d.buyer_contact_id
  AND c.remarketing_buyer_id IS NOT NULL;
