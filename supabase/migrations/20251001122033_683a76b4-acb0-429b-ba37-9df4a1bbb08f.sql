-- Phase 2 & 4 Combined: Performance Optimization - Add Database Indexes for Filtering

-- Indexes for deal filtering performance
-- These will significantly speed up filtering queries

-- Index for company-based filtering (contact_company)
CREATE INDEX IF NOT EXISTS idx_deals_contact_company 
ON deals(contact_company) 
WHERE contact_company IS NOT NULL;

-- Index for deal owner/assignment filtering
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to 
ON deals(assigned_to) 
WHERE assigned_to IS NOT NULL;

-- Index for created date filtering and sorting
CREATE INDEX IF NOT EXISTS idx_deals_created_at 
ON deals(created_at DESC);

-- Index for stage entry date filtering
CREATE INDEX IF NOT EXISTS idx_deals_stage_entered_at 
ON deals(stage_entered_at DESC) 
WHERE stage_entered_at IS NOT NULL;

-- Index for last activity/updated date filtering
CREATE INDEX IF NOT EXISTS idx_deals_updated_at 
ON deals(updated_at DESC);

-- Composite index for stage + created date queries (common combination)
CREATE INDEX IF NOT EXISTS idx_deals_stage_created 
ON deals(stage_id, created_at DESC);

-- Index for connection request lookups
CREATE INDEX IF NOT EXISTS idx_deals_connection_request 
ON deals(connection_request_id) 
WHERE connection_request_id IS NOT NULL;

-- Index for buyer priority score sorting
CREATE INDEX IF NOT EXISTS idx_deals_priority_score 
ON deals(buyer_priority_score DESC) 
WHERE buyer_priority_score IS NOT NULL;