-- Fix security issues identified by linter

-- 1. Fix function search_path (make functions immutable)
-- Update existing functions to set search_path parameter
ALTER FUNCTION update_nda_status(uuid, boolean) SET search_path = '';
ALTER FUNCTION update_fee_agreement_status(uuid, boolean) SET search_path = '';
ALTER FUNCTION update_connection_request_followup(uuid, boolean, text) SET search_path = '';
ALTER FUNCTION log_nda_email(uuid, text, text) SET search_path = '';
ALTER FUNCTION log_fee_agreement_email(uuid, text, text) SET search_path = '';
ALTER FUNCTION update_nda_email_status(uuid, boolean) SET search_path = '';
ALTER FUNCTION update_fee_agreement_email_status(uuid, boolean) SET search_path = '';

-- 2. Update OTP expiry to recommended 10 minutes (600 seconds)
-- This will be configured via Supabase dashboard for security

-- 3. Enable leaked password protection  
-- This will be configured via Supabase dashboard for security

-- Add comment for tracking
COMMENT ON SCHEMA public IS 'Security hardening applied - search_path fixed for functions';