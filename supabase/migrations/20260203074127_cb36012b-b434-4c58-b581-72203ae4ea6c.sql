-- Clean up placeholder values in street_address
UPDATE listings 
SET street_address = NULL 
WHERE LOWER(street_address) IN ('not found', 'n/a', 'unknown', 'none', 'tbd', 'not available', 'not specified');