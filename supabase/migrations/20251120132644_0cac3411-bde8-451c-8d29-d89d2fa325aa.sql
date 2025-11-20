-- Add hero_description column to listings table
-- This field allows custom preview text to be shown on listing cards/headers
-- Falls back to description excerpt when null
-- Recommended max length: 500 characters

ALTER TABLE listings 
ADD COLUMN hero_description TEXT;

COMMENT ON COLUMN listings.hero_description IS 'Custom preview description shown in listing header. Falls back to main description when null. Recommended max 500 chars.';