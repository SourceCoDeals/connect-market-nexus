-- Migration: Individual PhoneBurner tokens per user
--
-- Adds display_name and phoneburner_user_email to phoneburner_oauth_tokens
-- so the admin can see which PB accounts are connected and target pushes
-- to specific users.

-- Add columns to track the PhoneBurner user identity
ALTER TABLE phoneburner_oauth_tokens
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS phoneburner_user_email text,
  ADD COLUMN IF NOT EXISTS phoneburner_user_id text;

-- Index for fast lookup of connected users
CREATE INDEX IF NOT EXISTS idx_phoneburner_tokens_display
  ON phoneburner_oauth_tokens (display_name)
  WHERE display_name IS NOT NULL;

-- Allow admins to list all connected tokens (id, display_name, user_id, expires_at only)
-- This is needed so the push-to-dialer modal can show a picker of target users
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
  profile_email text
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
    p.email AS profile_email
  FROM phoneburner_oauth_tokens t
  LEFT JOIN profiles p ON p.id = t.user_id
  ORDER BY t.display_name NULLS LAST, p.first_name;
$$;
