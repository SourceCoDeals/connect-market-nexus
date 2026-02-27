-- ═══════════════════════════════════════════════════════════════
-- Migration: add_not_a_fit_to_valuation_leads
-- Date: 2026-03-29
-- Purpose: Adds a not_a_fit boolean column to valuation_leads so calculator
--          leads can be marked as "Not a Fit" independently of the listings table.
-- Tables affected: valuation_leads
-- ═══════════════════════════════════════════════════════════════

-- Add not_a_fit boolean column to valuation_leads
-- Allows marking valuation calculator leads as "Not a Fit" independently of the listings table

ALTER TABLE valuation_leads ADD COLUMN IF NOT EXISTS not_a_fit boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_valuation_leads_not_a_fit ON valuation_leads (not_a_fit);
