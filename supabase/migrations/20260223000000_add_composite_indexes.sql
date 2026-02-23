-- ============================================================================
-- Migration: Add composite indexes for common query patterns
-- Date: 2026-02-23
--
-- This migration adds targeted composite indexes based on analysis of actual
-- query patterns in the application hooks. Each index is documented with the
-- specific query pattern it optimizes. All use IF NOT EXISTS for idempotency.
-- ============================================================================


-- ============================================================================
-- LISTINGS TABLE
-- ============================================================================

-- Marketplace browse query: the primary marketplace query filters on
-- status = 'active', deleted_at IS NULL, and is_internal_deal = false,
-- then orders by created_at DESC. This partial composite index covers
-- that exact hot path. (see: use-listings.ts useListings)
CREATE INDEX IF NOT EXISTS idx_listings_marketplace_browse
ON public.listings(created_at DESC)
WHERE status = 'active' AND deleted_at IS NULL AND is_internal_deal = false;

-- Title search on active marketplace listings: the marketplace search
-- uses ilike on title within the active/non-internal/non-deleted filter.
-- A trigram index accelerates ILIKE '%term%' pattern matching.
-- (see: use-listings.ts filters.search -> .ilike('title', '%...%'))
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
ON public.listings USING gin(title gin_trgm_ops);


-- ============================================================================
-- DEALS TABLE
-- ============================================================================

-- My Deals query: admins fetch their assigned deals filtered by
-- deleted_at IS NULL, ordered by updated_at DESC. This composite
-- index covers that exact pattern. (see: use-my-deals.ts useMyDeals)
CREATE INDEX IF NOT EXISTS idx_deals_assigned_active
ON public.deals(assigned_to, updated_at DESC)
WHERE deleted_at IS NULL;

-- Deals by listing: deals are frequently looked up by listing_id for
-- cascade deletes, listing detail views, and the deal pipeline.
-- No single-column index exists for this FK. (see: use-deals.ts,
-- use-associated-requests.ts, delete cascades in RPCs)
CREATE INDEX IF NOT EXISTS idx_deals_listing_id
ON public.deals(listing_id);

-- Deal stage + listing composite: the get_deals_with_details RPC and
-- pipeline views frequently filter or join on (listing_id, stage_id).
-- (see: use-deals.ts useDeals RPC, Kanban board grouping by stage)
CREATE INDEX IF NOT EXISTS idx_deals_listing_stage
ON public.deals(listing_id, stage_id);


-- ============================================================================
-- CONNECTION_REQUESTS TABLE
-- ============================================================================

-- Connection status check: the marketplace checks whether the current
-- user already has a connection request for a given listing. This is a
-- point lookup on (listing_id, user_id). (see: use-connections.ts
-- useConnectionStatus)
CREATE INDEX IF NOT EXISTS idx_connection_requests_listing_user
ON public.connection_requests(listing_id, user_id);

-- User's connection requests list: buyers view their own requests
-- ordered by created_at DESC. The existing idx_connection_requests_user_status
-- includes status as a middle column which is not needed here.
-- (see: use-connections.ts useUserConnectionRequests)
CREATE INDEX IF NOT EXISTS idx_connection_requests_user_created
ON public.connection_requests(user_id, created_at DESC);

-- Admin connection requests dashboard: admins fetch all requests
-- ordered by created_at DESC. A covering index on (created_at DESC)
-- already exists via idx_connection_requests_status_created for
-- status-filtered queries, but the admin query fetches ALL statuses
-- and only orders by created_at. (see: use-connection-requests-query.ts)
CREATE INDEX IF NOT EXISTS idx_connection_requests_created
ON public.connection_requests(created_at DESC);

-- Source-based filtering: connection requests are frequently filtered
-- by source (marketplace, webflow, manual, import, API, website, referral)
-- in admin views. (see: admin connection request filters)
CREATE INDEX IF NOT EXISTS idx_connection_requests_source
ON public.connection_requests(source)
WHERE source IS NOT NULL;


-- ============================================================================
-- DATA ROOM TABLES
-- ============================================================================

-- Data room documents by deal + folder: documents are fetched per deal
-- and ordered by folder_name, then created_at DESC. This composite
-- index matches that access pattern exactly.
-- (see: use-data-room.ts useDataRoomDocuments)
CREATE INDEX IF NOT EXISTS idx_data_room_documents_deal_folder
ON public.data_room_documents(deal_id, folder_name, created_at DESC);

-- Audit log by deal + time: audit entries are queried per deal ordered
-- by created_at DESC with a LIMIT. This composite index supports that
-- pattern with efficient range scans. (see: use-data-room.ts
-- useDataRoomAuditLog)
CREATE INDEX IF NOT EXISTS idx_data_room_audit_log_deal_created
ON public.data_room_audit_log(deal_id, created_at DESC);


-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

-- RLS policy lookups: most RLS policies on listings and connection_requests
-- check profiles for (approval_status = 'approved' AND email_verified = true).
-- A partial index on the qualifying rows makes these policy checks faster.
-- (see: RLS policies across multiple tables)
CREATE INDEX IF NOT EXISTS idx_profiles_approved_verified
ON public.profiles(id)
WHERE approval_status = 'approved' AND email_verified = true;

-- Admin lookup: the is_admin() function and many admin-only queries
-- check is_admin = true. A partial index on admin profiles speeds up
-- these checks. (see: is_admin RPC, admin dashboard queries)
-- Note: idx_profiles_is_admin exists but only on (is_admin); this one
-- is the same pattern, so we skip re-creating it.


-- ============================================================================
-- REMARKETING SCORES TABLE
-- ============================================================================

-- Scores by listing + score: remarketing views show scores for a
-- specific listing sorted by composite_score DESC. The existing
-- single-column indexes on listing_id and composite_score don't
-- help when both are needed together.
-- (see: useReMarketingAnalytics, scoring dashboards)
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_listing_score
ON public.remarketing_scores(listing_id, composite_score DESC);

-- Scores by listing + status: outreach workflows filter scores by
-- listing and status (pending, approved, passed, hidden).
-- (see: remarketing outreach workflows)
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_listing_status
ON public.remarketing_scores(listing_id, status);


-- ============================================================================
-- LEAD MEMOS TABLE
-- ============================================================================

-- Memos by deal + type + status: memo queries filter by deal_id and
-- optionally by memo_type and status. This composite covers the most
-- common access pattern. (see: lead memo components, memo distribution)
CREATE INDEX IF NOT EXISTS idx_lead_memos_deal_type_status
ON public.lead_memos(deal_id, memo_type, status);


-- ============================================================================
-- USER ACTIVITY TABLE
-- ============================================================================

-- Activity by user + time: user activity is queried per user sorted
-- by created_at DESC. The existing idx_user_activity_user_type_created
-- includes activity_type in the middle, which is suboptimal when
-- fetching all activity types for a user.
-- (see: use-connections.ts activity insert, analytics)
CREATE INDEX IF NOT EXISTS idx_user_activity_user_created
ON public.user_activity(user_id, created_at DESC);


-- ============================================================================
-- REFRESH TABLE STATISTICS
-- ============================================================================

ANALYZE public.listings;
ANALYZE public.deals;
ANALYZE public.connection_requests;
ANALYZE public.data_room_documents;
ANALYZE public.data_room_audit_log;
ANALYZE public.profiles;
ANALYZE public.remarketing_scores;
ANALYZE public.lead_memos;
ANALYZE public.user_activity;
