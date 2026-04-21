
-- Backfill Aftercare Restoration deal row
UPDATE public.listings
SET revenue = 3000000, ebitda = 1000000
WHERE id = '7b89d794-0458-40b8-a4ce-6ac4defee740'
  AND (revenue IS NULL OR revenue = 0);

-- Backfill Aftercare marketplace child listing
UPDATE public.listings
SET revenue = 3000000, ebitda = 1000000
WHERE id = 'b5490603-dd2c-4b14-a397-d087e8fc6c51'
  AND (revenue IS NULL OR revenue = 0);

-- Backfill Cat Rec deal row (revenue only — no EBITDA in memo)
UPDATE public.listings
SET revenue = 3600000
WHERE id = '10d6e4f5-0477-4610-97c2-dcfbe577f9bc'
  AND (revenue IS NULL OR revenue = 0);
