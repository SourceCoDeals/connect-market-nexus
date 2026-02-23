
-- Fix security definer view by explicitly setting security_invoker
ALTER VIEW public.data_room_access_status SET (security_invoker = on);
