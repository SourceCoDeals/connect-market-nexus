-- Temporarily disable the deal alerts trigger to isolate the JSON error
DROP TRIGGER IF EXISTS trigger_deal_alerts ON listings;

-- Check what columns are causing issues by inspecting the actual data types
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'listings' 
AND table_schema = 'public'
ORDER BY ordinal_position;