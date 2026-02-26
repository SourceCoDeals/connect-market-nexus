-- Add is_manual_token column and make refresh_token nullable for manual token support
ALTER TABLE public.phoneburner_oauth_tokens 
  ADD COLUMN IF NOT EXISTS is_manual_token boolean NOT NULL DEFAULT false;

ALTER TABLE public.phoneburner_oauth_tokens 
  ALTER COLUMN refresh_token DROP NOT NULL;