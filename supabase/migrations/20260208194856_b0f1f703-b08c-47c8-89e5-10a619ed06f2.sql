
-- Add main contact fields to listings table for Fireflies integration
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS main_contact_name TEXT,
ADD COLUMN IF NOT EXISTS main_contact_email TEXT,
ADD COLUMN IF NOT EXISTS main_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS main_contact_title TEXT;

-- Add notes_analyzed_at to remarketing_buyers if not exists
ALTER TABLE public.remarketing_buyers
ADD COLUMN IF NOT EXISTS notes_analyzed_at TIMESTAMPTZ;
