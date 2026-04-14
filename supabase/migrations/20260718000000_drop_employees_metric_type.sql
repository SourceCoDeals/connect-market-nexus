-- Deprecate the 'employees' metric_3_type value.
--
-- The Team Size (employees) metric has been removed from all marketplace-facing
-- preview surfaces (ListingDetail, ListingPreview, EditorLivePreview,
-- ClientPreviewDialog) to match the earlier removal from the marketplace grid
-- card (see commit de53971). Metric 3 is now custom-only.
--
-- This migration:
--   1. Rewrites every row with metric_3_type = 'employees' (or NULL) to a
--      sensible custom fallback based on whatever data the row already has.
--   2. Changes the column default from 'employees' to 'custom'.
--   3. Updates the column comment.
--
-- The full_time_employees and part_time_employees columns are intentionally
-- left in place — they are still consumed by deal scoring, CSV export, the
-- admin deal pipeline, and other non-marketplace surfaces.

-- Step 1: backfill legacy rows
UPDATE listings
SET
  metric_3_type = 'custom',
  metric_3_custom_label = CASE
    WHEN number_of_locations IS NOT NULL AND number_of_locations > 0 THEN 'Locations'
    WHEN founded_year IS NOT NULL AND founded_year > 0 THEN 'Years Established'
    ELSE 'Transaction Type'
  END,
  metric_3_custom_value = CASE
    WHEN number_of_locations IS NOT NULL AND number_of_locations > 0 THEN number_of_locations::text
    WHEN founded_year IS NOT NULL AND founded_year > 0 THEN (EXTRACT(YEAR FROM CURRENT_DATE)::int - founded_year)::text
    ELSE '100% Sale'
  END,
  metric_3_custom_subtitle = CASE
    WHEN number_of_locations IS NOT NULL AND number_of_locations > 0 THEN 'Across service area'
    WHEN founded_year IS NOT NULL AND founded_year > 0 THEN 'Founded ' || founded_year::text
    ELSE 'Full equity exit'
  END
WHERE metric_3_type = 'employees' OR metric_3_type IS NULL;

-- Step 2: change column default
ALTER TABLE listings ALTER COLUMN metric_3_type SET DEFAULT 'custom';

-- Step 3: update column comment
COMMENT ON COLUMN listings.metric_3_type IS
  'Type of third metric on listing detail cards: custom only. The legacy ''employees'' value is deprecated as of 2026-04-14.';
