-- Data Migration: Migrate existing internal_primary_owner text to primary_owner_id UUID
-- This is a best-effort migration that matches text names to admin profiles

-- First, try to match by full name
UPDATE listings l
SET primary_owner_id = p.id
FROM profiles p
WHERE 
  l.internal_primary_owner IS NOT NULL
  AND l.primary_owner_id IS NULL
  AND (
    -- Match by full name (case insensitive)
    LOWER(TRIM(l.internal_primary_owner)) = LOWER(TRIM(p.first_name || ' ' || p.last_name))
    OR LOWER(TRIM(l.internal_primary_owner)) = LOWER(TRIM(p.last_name || ' ' || p.first_name))
  )
  AND (p.email LIKE '%@sourcecodeals.com' OR p.email LIKE '%@captarget.com')
  AND p.is_admin = true;

-- Second, try to match by first name only
UPDATE listings l
SET primary_owner_id = p.id
FROM profiles p
WHERE 
  l.internal_primary_owner IS NOT NULL
  AND l.primary_owner_id IS NULL
  AND LOWER(TRIM(l.internal_primary_owner)) = LOWER(TRIM(p.first_name))
  AND (p.email LIKE '%@sourcecodeals.com' OR p.email LIKE '%@captarget.com')
  AND p.is_admin = true;

-- Third, try to match by email username (before @)
UPDATE listings l
SET primary_owner_id = p.id
FROM profiles p
WHERE 
  l.internal_primary_owner IS NOT NULL
  AND l.primary_owner_id IS NULL
  AND LOWER(TRIM(l.internal_primary_owner)) = LOWER(SPLIT_PART(p.email, '@', 1))
  AND (p.email LIKE '%@sourcecodeals.com' OR p.email LIKE '%@captarget.com')
  AND p.is_admin = true;

-- Create a view to see unmapped listings for manual review
CREATE OR REPLACE VIEW unmapped_primary_owners AS
SELECT 
  id,
  title,
  internal_company_name,
  internal_primary_owner,
  'No matching admin found - needs manual review' as migration_status,
  created_at
FROM listings
WHERE 
  internal_primary_owner IS NOT NULL 
  AND internal_primary_owner != ''
  AND primary_owner_id IS NULL
ORDER BY created_at DESC;

-- Add comment to view
COMMENT ON VIEW unmapped_primary_owners IS 'Listings with internal_primary_owner text that could not be automatically mapped to a primary_owner_id UUID';