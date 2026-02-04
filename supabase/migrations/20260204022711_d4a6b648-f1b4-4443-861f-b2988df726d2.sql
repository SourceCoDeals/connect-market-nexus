-- Add investment_date column to remarketing_buyers table
ALTER TABLE public.remarketing_buyers 
ADD COLUMN IF NOT EXISTS investment_date DATE;