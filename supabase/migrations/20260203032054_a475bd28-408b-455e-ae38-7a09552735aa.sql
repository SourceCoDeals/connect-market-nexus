-- Add linkedin_employee_range column to listings table
-- This complements the existing linkedin_employee_count numeric field
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS linkedin_employee_range TEXT;