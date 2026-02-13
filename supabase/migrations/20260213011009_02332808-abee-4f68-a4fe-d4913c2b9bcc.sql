-- Move notes to general_notes for all captarget deals
UPDATE listings
SET general_notes = notes, notes = NULL
WHERE deal_source = 'captarget'
  AND notes IS NOT NULL
  AND (general_notes IS NULL OR general_notes = '');