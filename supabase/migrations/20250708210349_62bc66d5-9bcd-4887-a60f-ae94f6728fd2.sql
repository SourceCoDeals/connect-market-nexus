-- Add user_message column to connection_requests for custom messages.
--
-- Guarded with IF EXISTS / IF NOT EXISTS so a fresh replay from scratch
-- doesn't break: this file is timestamped before 20251120211917 (the
-- migration that actually CREATE TABLEs connection_requests). Prod
-- already has the column from a successful replay against a shared
-- history — this guard only matters for DR / local replay from zero.
ALTER TABLE IF EXISTS public.connection_requests
  ADD COLUMN IF NOT EXISTS user_message TEXT;
