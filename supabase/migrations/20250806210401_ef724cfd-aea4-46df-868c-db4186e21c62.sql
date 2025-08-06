-- Add custom_sections JSONB field to listings table for admin-editable sections
ALTER TABLE public.listings 
ADD COLUMN custom_sections JSONB DEFAULT '[]'::jsonb;