-- ============================================================
-- REMARKETING DATA ISOLATION FIX
-- Phase 1: Emergency Data Cleanup + Schema Hardening
-- ============================================================

-- Step 1: Fix all leaked deals that should be internal
-- Targets: listings with website field populated, created today, or matching research patterns
UPDATE listings
SET is_internal_deal = true, updated_at = now()
WHERE deleted_at IS NULL
  AND coalesce(is_internal_deal, false) = false
  AND (
    -- Has website field (typical of research/remarketing deals)
    (website IS NOT NULL AND website != '')
    OR
    -- Recent suspicious batch (today's imports at 05:27)
    created_at >= '2026-02-05 05:00:00'::timestamptz
    OR
    -- Known research-style patterns in title
    title ~* '(collision|auto body|hvac|plumbing|roofing|sheet metal|heating|cooling|mechanical)'
  );

-- Step 2: Change the default value for is_internal_deal to TRUE
-- This is the "fail-safe" approach - new listings are hidden by default
-- Only explicit marketplace publishing (via admin form) sets it to false
ALTER TABLE listings ALTER COLUMN is_internal_deal SET DEFAULT true;

-- Step 3: Create a validation trigger to prevent accidental marketplace publishing
-- Listings that have remarketing-style fields should not be set to is_internal_deal = false
-- unless they have proper marketplace metadata (hero_description filled)
CREATE OR REPLACE FUNCTION validate_marketplace_publishing()
RETURNS TRIGGER AS $$
BEGIN
  -- If trying to publish to marketplace (is_internal_deal = false)
  -- and the listing looks like a research deal, require hero_description
  IF NEW.is_internal_deal = false THEN
    -- If website is populated but no hero_description, it's likely a research deal
    -- that shouldn't be on the marketplace
    IF (NEW.website IS NOT NULL AND NEW.website != '') 
       AND (NEW.hero_description IS NULL OR NEW.hero_description = '') THEN
      -- Allow it but log a warning (we don't want to hard-block admin workflow)
      -- Instead, we rely on the default being true and explicit admin action
      RAISE WARNING 'Publishing listing % to marketplace without hero_description despite having website field', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS trg_validate_marketplace_publishing ON listings;

CREATE TRIGGER trg_validate_marketplace_publishing
BEFORE INSERT OR UPDATE ON listings
FOR EACH ROW
EXECUTE FUNCTION validate_marketplace_publishing();

-- Step 4: Create audit log trigger for is_internal_deal changes
CREATE OR REPLACE FUNCTION log_internal_deal_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if is_internal_deal actually changed
  IF OLD.is_internal_deal IS DISTINCT FROM NEW.is_internal_deal THEN
    INSERT INTO audit_logs (
      table_name,
      operation,
      old_data,
      new_data,
      metadata
    ) VALUES (
      'listings',
      'UPDATE',
      jsonb_build_object('is_internal_deal', OLD.is_internal_deal, 'id', OLD.id, 'title', OLD.title),
      jsonb_build_object('is_internal_deal', NEW.is_internal_deal, 'id', NEW.id, 'title', NEW.title),
      jsonb_build_object('change_type', 'marketplace_visibility', 'changed_at', now())
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_internal_deal_changes ON listings;

CREATE TRIGGER trg_log_internal_deal_changes
AFTER UPDATE ON listings
FOR EACH ROW
EXECUTE FUNCTION log_internal_deal_changes();