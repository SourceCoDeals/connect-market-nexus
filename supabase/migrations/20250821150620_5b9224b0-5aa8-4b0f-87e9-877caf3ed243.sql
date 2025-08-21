-- Add decision_notes column to connection_requests if it doesn't exist
ALTER TABLE public.connection_requests ADD COLUMN IF NOT EXISTS decision_notes TEXT;