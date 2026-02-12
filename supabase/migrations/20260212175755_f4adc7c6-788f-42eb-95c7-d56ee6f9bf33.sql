-- P0 FIX: Clear stale captarget rows that have old-format hashes
-- These rows have no enrichment data (all revenue/ebitda NULL after our cleanup)
-- The sync will re-import them with correct 6-field hashes on next run
DELETE FROM listings WHERE deal_source = 'captarget';