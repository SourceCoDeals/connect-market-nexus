-- Add 'not_a_fit' to the remarketing_status CHECK constraint on listings
-- The remarketing_status column uses TEXT + CHECK (not an enum type)
-- This allows deals to be marked as "Not a Fit" and hidden from lead tracker views

-- Drop the existing constraint and recreate with the new value
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listings_remarketing_status_check'
  ) THEN
    ALTER TABLE public.listings
      DROP CONSTRAINT listings_remarketing_status_check;
  END IF;

  -- Add updated constraint that includes 'not_a_fit'
  ALTER TABLE public.listings
    ADD CONSTRAINT listings_remarketing_status_check
    CHECK (remarketing_status IN ('active', 'archived', 'excluded', 'completed', 'not_a_fit'));
END $$;
