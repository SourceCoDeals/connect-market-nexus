-- Add target_buyer_types column to store AI-extracted buyer profiles
ALTER TABLE remarketing_buyer_universes 
ADD COLUMN IF NOT EXISTS target_buyer_types JSONB DEFAULT '[]'::jsonb;