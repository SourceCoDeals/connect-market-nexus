-- Referral Partner Tracker: complete schema migration
-- Ensures referral_partners base table exists, adds share credentials,
-- creates referral_submissions table, and enables RLS policies.

-- 1. Ensure referral_partners base table exists
CREATE TABLE IF NOT EXISTS public.referral_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  deal_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add sharing columns to referral_partners
ALTER TABLE public.referral_partners
  ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE DEFAULT gen_random_uuid();
ALTER TABLE public.referral_partners
  ADD COLUMN IF NOT EXISTS share_password_hash TEXT;
ALTER TABLE public.referral_partners
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

-- Index on share_token for fast public tracker lookups
CREATE INDEX IF NOT EXISTS idx_referral_partners_share_token
  ON public.referral_partners (share_token);

-- 3. Ensure listings FK to referral_partners exists
DO $$ BEGIN
  ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS referral_partner_id UUID
    REFERENCES public.referral_partners(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_referral_partner_id
  ON public.listings (referral_partner_id);

-- 4. Create referral_submissions table
CREATE TABLE IF NOT EXISTS public.referral_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_partner_id UUID NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  revenue NUMERIC,
  ebitda NUMERIC,
  location TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast partner lookups
CREATE INDEX IF NOT EXISTS idx_referral_submissions_partner
  ON public.referral_submissions (referral_partner_id);

-- Partial index for pending submissions queue
CREATE INDEX IF NOT EXISTS idx_referral_submissions_status
  ON public.referral_submissions (status) WHERE status = 'pending';

-- 5. Row Level Security
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage referral partners"
    ON public.referral_partners FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage referral submissions"
    ON public.referral_submissions FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
