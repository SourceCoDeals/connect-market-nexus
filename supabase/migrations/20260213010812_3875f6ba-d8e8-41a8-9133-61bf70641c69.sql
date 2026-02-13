-- Move description to notes for all captarget deals where notes is empty
UPDATE listings
SET notes = description, description = NULL
WHERE deal_source = 'captarget'
  AND description IS NOT NULL
  AND (notes IS NULL OR notes = '');