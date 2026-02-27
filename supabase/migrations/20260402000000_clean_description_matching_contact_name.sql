-- Clean up listings where description incorrectly contains the contact name
-- This typically happens from CSV imports where the description column was
-- populated with contact name data instead of actual business descriptions.
UPDATE listings
SET description = NULL
WHERE description IS NOT NULL
  AND main_contact_name IS NOT NULL
  AND TRIM(description) = TRIM(main_contact_name);
