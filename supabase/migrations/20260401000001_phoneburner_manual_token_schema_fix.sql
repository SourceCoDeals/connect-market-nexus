-- Fix: Apply missing manual token schema changes for phoneburner_oauth_tokens
--
-- The 20260226000000_phoneburner_manual_tokens migration was added with an older
-- timestamp than already-applied migrations, so Supabase skipped it.
-- This migration applies those missing changes idempotently.

-- Make refresh_token nullable (not needed for manual tokens)
ALTER TABLE phoneburner_oauth_tokens
  ALTER COLUMN refresh_token DROP NOT NULL;

-- Add is_manual_token flag if it doesn't exist
ALTER TABLE phoneburner_oauth_tokens
  ADD COLUMN IF NOT EXISTS is_manual_token boolean NOT NULL DEFAULT false;

-- Update the get_phoneburner_connected_users() RPC to also return is_manual_token
CREATE OR REPLACE FUNCTION public.get_phoneburner_connected_users()
RETURNS TABLE (
  token_id uuid,
  user_id uuid,
  display_name text,
  phoneburner_user_email text,
  expires_at timestamptz,
  updated_at timestamptz,
  profile_first_name text,
  profile_last_name text,
  profile_email text,
  is_manual_token boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    t.id AS token_id,
    t.user_id,
    t.display_name,
    t.phoneburner_user_email,
    t.expires_at::timestamptz,
    t.updated_at::timestamptz,
    p.first_name AS profile_first_name,
    p.last_name AS profile_last_name,
    p.email AS profile_email,
    t.is_manual_token
  FROM phoneburner_oauth_tokens t
  LEFT JOIN profiles p ON p.id = t.user_id
  ORDER BY t.display_name NULLS LAST, p.first_name;
$$;
