-- Migration: Support manual PhoneBurner access tokens
--
-- Allows admins to paste a PhoneBurner access token directly
-- instead of going through the OAuth flow. Manual tokens are
-- not refreshed automatically — the user must update them if they expire.

-- Make refresh_token nullable (not needed for manual tokens)
ALTER TABLE phoneburner_oauth_tokens
  ALTER COLUMN refresh_token DROP NOT NULL;

-- Flag to identify manually-entered tokens (vs OAuth tokens)
ALTER TABLE phoneburner_oauth_tokens
  ADD COLUMN IF NOT EXISTS is_manual_token boolean NOT NULL DEFAULT false;
