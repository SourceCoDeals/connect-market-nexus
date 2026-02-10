-- Referral Partner Tracker: schema additions
-- Adds share credentials to referral_partners and creates referral_submissions table

-- 1. Add new columns to referral_partners for shared tracker
ALTER TABLE referral_partners
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS share_password_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

-- Index on share_token for fast lookups on public tracker
CREATE INDEX IF NOT EXISTS idx_referral_partners_share_token
  ON referral_partners (share_token);

-- 2. Create referral_submissions table
CREATE TABLE IF NOT EXISTS referral_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_partner_id UUID NOT NULL REFERENCES referral_partners(id) ON DELETE CASCADE,
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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast partner lookups
CREATE INDEX IF NOT EXISTS idx_referral_submissions_partner
  ON referral_submissions (referral_partner_id);

-- Index for pending submissions queue
CREATE INDEX IF NOT EXISTS idx_referral_submissions_status
  ON referral_submissions (status) WHERE status = 'pending';
