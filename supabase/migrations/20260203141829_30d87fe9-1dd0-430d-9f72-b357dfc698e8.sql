-- Add fireflies_url column to listings table for storing Fireflies recording URLs
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS fireflies_url TEXT;