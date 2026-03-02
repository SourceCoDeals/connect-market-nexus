-- Drop dead listing columns that are no longer read or written by any application code.
-- These were added for the old generate-listing-content AI pipeline which has been
-- replaced by the lead memo generator (generate-lead-memo).
--
-- revenue_model_breakdown: Was rendered by EnhancedInvestorDashboard (now deleted).
--   Zero application references remain.
-- market_position: Was only in type definitions, never read or written by app code.
-- transaction_preferences: Was only in type definitions, never read or written by app code.

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS revenue_model_breakdown,
  DROP COLUMN IF EXISTS market_position,
  DROP COLUMN IF EXISTS transaction_preferences;
