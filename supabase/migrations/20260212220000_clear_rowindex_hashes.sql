-- Hash formula audit fix: remove rowIndex and tabName from hash
--
-- The previous hash formula included tabName and rowIndex:
--   `${tabName}|...|row${rowIndex}`
--
-- Problems:
--   1. rowIndex is position-dependent — adding/removing any row shifts ALL
--      subsequent hashes, breaking dedup for 100% of rows after the edit.
--   2. tabName changes when a company moves Active→Inactive, creating duplicates.
--
-- New formula uses only data-based fields:
--   `${clientName}|${companyName}|${dateRaw}|${email}|${firstName}|${lastName}|${details}`
--
-- This migration clears all existing hashes so the next sync recomputes them
-- using the stable data-only formula.

UPDATE public.listings
SET captarget_row_hash = NULL
WHERE deal_source = 'captarget'
  AND captarget_row_hash IS NOT NULL;
