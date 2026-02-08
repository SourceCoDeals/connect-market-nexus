-- Add optimistic locking to remarketing_buyers table
-- This prevents concurrent edit conflicts (e.g., user editing while enrichment runs)

-- 1. Add version column
ALTER TABLE remarketing_buyers
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 2. Create trigger function to auto-increment version on UPDATE
CREATE OR REPLACE FUNCTION increment_buyer_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if data has actually changed (not just timestamp updates)
  IF NEW.* IS DISTINCT FROM OLD.* THEN
    NEW.version = COALESCE(OLD.version, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger
DROP TRIGGER IF EXISTS buyer_version_trigger ON remarketing_buyers;
CREATE TRIGGER buyer_version_trigger
  BEFORE UPDATE ON remarketing_buyers
  FOR EACH ROW
  EXECUTE FUNCTION increment_buyer_version();

-- 4. Add comment for documentation
COMMENT ON COLUMN remarketing_buyers.version IS 'Optimistic locking version number. Auto-increments on each UPDATE. Frontend should include version in updates and check for conflicts.';

-- 5. Backfill existing records with version = 1 (already DEFAULT)
-- (No action needed - DEFAULT handles this)

-- Usage Example:
-- Frontend UPDATE should be:
-- UPDATE remarketing_buyers
-- SET target_revenue_min = $1, version = version + 1
-- WHERE id = $2 AND version = $3;
--
-- If no rows updated (version mismatch), return 409 Conflict error to user
