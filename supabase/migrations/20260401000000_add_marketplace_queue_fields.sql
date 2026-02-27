-- ═══════════════════════════════════════════════════════════════
-- Migration: add_marketplace_queue_fields
-- Date: 2026-04-01
-- Purpose: Adds tracking columns for marketplace queue status on listings,
--          including pushed flag, timestamp, and actor.
-- Tables affected: listings
-- ═══════════════════════════════════════════════════════════════

-- Add marketplace queue tracking fields to listings table
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS pushed_to_marketplace boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pushed_to_marketplace_at timestamptz,
  ADD COLUMN IF NOT EXISTS pushed_to_marketplace_by text;

-- Index for fast marketplace queue lookups
CREATE INDEX IF NOT EXISTS idx_listings_pushed_to_marketplace
  ON listings (pushed_to_marketplace)
  WHERE pushed_to_marketplace = true;
