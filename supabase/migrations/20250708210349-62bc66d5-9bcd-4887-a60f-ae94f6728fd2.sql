
-- Add a column to store custom messages with connection requests
ALTER TABLE public.connection_requests 
ADD COLUMN user_message TEXT;
