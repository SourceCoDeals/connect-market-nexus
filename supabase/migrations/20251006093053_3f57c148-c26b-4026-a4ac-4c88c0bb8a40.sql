-- Add employee fields to listings table
ALTER TABLE listings 
ADD COLUMN full_time_employees INTEGER,
ADD COLUMN part_time_employees INTEGER;