-- Add acquisition_type column to listings table
ALTER TABLE listings 
ADD COLUMN acquisition_type TEXT CHECK (acquisition_type IN ('add_on', 'platform', NULL));