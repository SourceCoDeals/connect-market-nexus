-- Add a FK from connection_requests.user_id to profiles.id for PostgREST join support
-- The existing FK to auth.users stays; this adds a second FK for the profiles join
ALTER TABLE public.connection_requests
  ADD CONSTRAINT connection_requests_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;