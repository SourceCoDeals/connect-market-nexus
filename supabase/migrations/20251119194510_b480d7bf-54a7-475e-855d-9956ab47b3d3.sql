-- Add custom_message column to deal_sourcing_requests table
ALTER TABLE public.deal_sourcing_requests
ADD COLUMN IF NOT EXISTS custom_message text;