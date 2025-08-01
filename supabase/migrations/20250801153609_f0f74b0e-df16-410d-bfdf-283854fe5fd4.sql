-- Add phone and calendly URL fields to admin signature preferences table
ALTER TABLE admin_signature_preferences 
ADD COLUMN phone_number TEXT,
ADD COLUMN calendly_url TEXT;