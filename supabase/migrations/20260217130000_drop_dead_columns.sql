-- Phase 1: Drop confirmed dead columns from listings table
-- These columns have ZERO code references outside types.ts and migrations.
-- Verified via grep across src/ and supabase/functions/ on 2026-02-17.

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS ai_description,
  DROP COLUMN IF EXISTS estimated_ebitda,
  DROP COLUMN IF EXISTS lead_source_notes,
  DROP COLUMN IF EXISTS is_owner_dependent,
  DROP COLUMN IF EXISTS has_multiple_locations,
  DROP COLUMN IF EXISTS product_revenue_percentage,
  DROP COLUMN IF EXISTS service_revenue_percentage,
  DROP COLUMN IF EXISTS recurring_revenue_percentage,
  DROP COLUMN IF EXISTS project_revenue_percentage,
  DROP COLUMN IF EXISTS calculated_rank,
  DROP COLUMN IF EXISTS final_rank,
  DROP COLUMN IF EXISTS rank_locked,
  DROP COLUMN IF EXISTS last_ranked_at,
  DROP COLUMN IF EXISTS enrichment_scheduled_at,
  DROP COLUMN IF EXISTS enrichment_last_attempted_at,
  DROP COLUMN IF EXISTS enrichment_refresh_due_at,
  DROP COLUMN IF EXISTS enrichment_last_successful_at,
  DROP COLUMN IF EXISTS enrichment_error_message,
  DROP COLUMN IF EXISTS deal_industry_score,
  DROP COLUMN IF EXISTS deal_motivation_score;
