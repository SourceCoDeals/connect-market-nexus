-- Delete test submissions
DELETE FROM valuation_leads
WHERE email IN ('test@test.com', 'test@test.net')
  AND excluded = false;

-- Delete Lovable test accounts
DELETE FROM valuation_leads
WHERE email ILIKE '%@lovabletest.com'
  AND excluded = false;

-- Delete excluded @sourcecodeals.com clutter
DELETE FROM valuation_leads
WHERE email ILIKE '%@sourcecodeals.com'
  AND excluded = true;