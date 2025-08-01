-- Fix database function search_path security issue for production
-- Set search_path for existing functions to prevent function search path warnings

-- Fix search_path for NDA functions  
ALTER FUNCTION update_nda_status(uuid, boolean, text) SET search_path = 'public';
ALTER FUNCTION update_nda_email_status(uuid, boolean, text) SET search_path = 'public';
ALTER FUNCTION log_nda_email(uuid, text, text) SET search_path = 'public';

-- Fix search_path for fee agreement functions
ALTER FUNCTION update_fee_agreement_status(uuid, boolean, text) SET search_path = 'public';
ALTER FUNCTION update_fee_agreement_email_status(uuid, boolean, text) SET search_path = 'public'; 
ALTER FUNCTION log_fee_agreement_email(uuid, text, text) SET search_path = 'public';

-- Fix search_path for follow-up function
ALTER FUNCTION update_connection_request_followup(uuid, boolean, text) SET search_path = 'public';

-- Add tracking comment
COMMENT ON SCHEMA public IS 'Production security hardening - search_path fixed for admin functions';