-- CapTarget rows don't have revenue/ebitda/long descriptions.
-- Skip the strict validation trigger for deal_source = 'captarget'.
CREATE OR REPLACE FUNCTION validate_listing_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip validation for captarget-sourced deals (they lack financial data)
  IF NEW.deal_source = 'captarget' THEN
    RETURN NEW;
  END IF;

  -- Ensure revenue is reasonable (between $1K and $1B)
  IF NEW.revenue IS NOT NULL AND (NEW.revenue < 1000 OR NEW.revenue > 1000000000) THEN
    RAISE EXCEPTION 'Revenue must be between $1,000 and $1,000,000,000';
  END IF;

  -- Ensure EBITDA is reasonable relative to revenue
  IF NEW.revenue IS NOT NULL AND NEW.ebitda IS NOT NULL AND NEW.ebitda > NEW.revenue * 2 THEN
    RAISE EXCEPTION 'EBITDA cannot exceed 200%% of revenue';
  END IF;

  -- Validate title length
  IF NEW.title IS NOT NULL AND (LENGTH(NEW.title) < 5 OR LENGTH(NEW.title) > 200) THEN
    RAISE EXCEPTION 'Title must be between 5 and 200 characters';
  END IF;

  -- Validate description length
  IF NEW.description IS NOT NULL AND (LENGTH(NEW.description) < 20 OR LENGTH(NEW.description) > 5000) THEN
    RAISE EXCEPTION 'Description must be between 20 and 5000 characters';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
