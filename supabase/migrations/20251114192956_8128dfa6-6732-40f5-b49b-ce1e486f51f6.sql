-- Drop interest_signals table (useless feature)
DROP TABLE IF EXISTS interest_signals CASCADE;

-- Add email tracking to deal_referrals
ALTER TABLE deal_referrals 
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cc_sender BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';