-- Add admin attribution columns for approval and rejection tracking
ALTER TABLE public.connection_requests 
ADD COLUMN approved_by uuid REFERENCES auth.users(id),
ADD COLUMN approved_at timestamp with time zone,
ADD COLUMN rejected_by uuid REFERENCES auth.users(id),
ADD COLUMN rejected_at timestamp with time zone;