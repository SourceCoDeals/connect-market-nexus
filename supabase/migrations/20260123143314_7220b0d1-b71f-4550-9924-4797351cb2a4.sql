-- Add key_quotes column to listings table for storing important seller quotes
ALTER TABLE listings ADD COLUMN IF NOT EXISTS key_quotes text[];

-- Add services column to listings table for storing service types
ALTER TABLE listings ADD COLUMN IF NOT EXISTS services text[];