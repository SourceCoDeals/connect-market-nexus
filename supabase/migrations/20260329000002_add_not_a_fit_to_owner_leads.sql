-- ═══════════════════════════════════════════════════════════════
-- Migration: add_not_a_fit_to_owner_leads
-- Date: 2026-03-29
-- Purpose: Adds a partial index on the inbound_leads status column for the
--          'not_a_fit' value, enabling fast filtering of owner/seller leads.
-- Tables affected: inbound_leads
-- ═══════════════════════════════════════════════════════════════

-- Add "not_a_fit" as a recognized status value for owner/seller leads in the inbound_leads table.
-- Owner leads use a text `status` column (not the remarketing_status enum),
-- so no schema change is needed -- this migration just adds a partial index
-- to speed up filtering out not-a-fit leads from the default view.

CREATE INDEX IF NOT EXISTS idx_inbound_leads_not_a_fit
  ON inbound_leads (status)
  WHERE status = 'not_a_fit';
