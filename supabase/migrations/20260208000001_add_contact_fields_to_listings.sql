-- Add main contact fields to listings table for Fireflies integration
-- These fields are used to auto-load transcripts by participant email

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS main_contact_name TEXT,
ADD COLUMN IF NOT EXISTS main_contact_email TEXT,
ADD COLUMN IF NOT EXISTS main_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS main_contact_title TEXT;

-- Index for fast lookups by email
CREATE INDEX IF NOT EXISTS idx_listings_main_contact_email
ON listings(main_contact_email)
WHERE main_contact_email IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN listings.main_contact_name IS
'Primary seller contact name - used for Fireflies transcript matching';

COMMENT ON COLUMN listings.main_contact_email IS
'Primary seller contact email - used to auto-load Fireflies transcripts via API';

COMMENT ON COLUMN listings.main_contact_phone IS
'Primary seller contact phone number';

COMMENT ON COLUMN listings.main_contact_title IS
'Primary seller contact title/position (e.g., CEO, CFO, Owner)';
