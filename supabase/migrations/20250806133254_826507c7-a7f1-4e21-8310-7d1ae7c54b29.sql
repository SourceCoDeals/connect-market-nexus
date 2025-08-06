-- Temporarily disable the problematic trigger to isolate the listing creation
DROP TRIGGER IF EXISTS trigger_deal_alerts ON listings;

-- Check if there are any other triggers that might be interfering
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'listings';