
-- Fix 1: Remove duplicate trigger (two triggers doing the exact same thing)
DROP TRIGGER IF EXISTS trigger_auto_generate_deal_identifier ON public.listings;

-- Fix 2: Reset the deal_identifier sequence to be safely past all existing identifiers
-- Max existing is 509, set to 1000 for safety buffer
SELECT setval('public.deal_identifier_seq', 1000, true);
