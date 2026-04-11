-- ============================================================================
-- CLEANUP: Drop superseded deal creation functions and redundant triggers
-- ============================================================================
--
-- Context: The `deals` table was renamed to `deal_pipeline` in migration
-- 20260506000000. Over multiple phases, several trigger functions were
-- created, rewritten, and superseded. This migration consolidates to a
-- single canonical deal creation path.
--
-- CANONICAL deal creation flow after this migration:
--
--   1. Buyer submits connection request → NO deal created.
--
--   2. Admin approves → DB trigger `trg_auto_create_deal_from_connection`
--      fires `auto_create_deal_from_approved_connection()`, which inserts
--      into `deal_pipeline` with dedup on `connection_request_id`.
--
--   3. Portal deal push → Client calls `create_pipeline_deal()` RPC
--      explicitly (needed because portal INSERTs with status='approved'
--      directly, so the UPDATE trigger doesn't fire).
--
-- Both paths (trigger + RPC) have dedup guards, so duplicate deals
-- cannot be created.
--
-- WHAT THIS MIGRATION DROPS:
--
--   Function                               | Had active trigger?     | Safe to drop?
--   ----------------------------------------|------------------------|---------------
--   create_deal_from_connection_request()   | NO (dropped 20251006)  | YES
--   create_deal_on_request_approval()       | YES (trg from 20250829)| YES — superseded by auto_create_deal_from_approved_connection
--   create_deal_from_inbound_lead()         | YES (trg on inbound_leads)| YES — leads now go through connection_request approval
--
-- CASCADE will also drop the associated triggers automatically.
-- ============================================================================

-- ── 1. Drop function: create_deal_from_connection_request ─────────────────
-- Originally the INSERT trigger function (20250829140751). The trigger was
-- dropped in 20251006174137. Function was rewritten in 20260506200000 but
-- never re-wired to a trigger. CASCADE is a no-op here (no dependents).
DROP FUNCTION IF EXISTS public.create_deal_from_connection_request() CASCADE;

-- ── 2. Drop function: create_deal_on_request_approval ─────────────────────
-- Created in 20250829162014 with trigger `trg_create_deal_on_request_approval`
-- (AFTER UPDATE on connection_requests). This trigger is REDUNDANT with
-- `trg_auto_create_deal_from_connection` (20260523000001) which calls the
-- newer `auto_create_deal_from_approved_connection()`. Both fire on approval,
-- both have dedup, but having two triggers is confusing and wasteful.
-- CASCADE will drop `trg_create_deal_on_request_approval` automatically.
DROP FUNCTION IF EXISTS public.create_deal_on_request_approval() CASCADE;

-- ── 3. Drop function: create_deal_from_inbound_lead ───────────────────────
-- Created in 20250829140751 with trigger `auto_create_deal_from_inbound_lead`
-- (AFTER UPDATE on inbound_leads, fires when status → 'converted').
-- The inbound lead flow now goes through convert_inbound_lead_to_request →
-- connection_request INSERT → admin approval → trg_auto_create_deal_from_connection.
-- CASCADE will drop `auto_create_deal_from_inbound_lead` trigger automatically.
DROP FUNCTION IF EXISTS public.create_deal_from_inbound_lead() CASCADE;

-- ── 4. Add clarifying comments to the ACTIVE functions ────────────────────
COMMENT ON FUNCTION public.auto_create_deal_from_approved_connection() IS
  'CANONICAL deal creation path for marketplace connection requests. '
  'Fires via trigger trg_auto_create_deal_from_connection (AFTER UPDATE '
  'on connection_requests) when status changes to ''approved''. '
  'Deduplicates on connection_request_id — safe to call alongside the '
  'create_pipeline_deal() RPC. '
  'See also: create_pipeline_deal() RPC for portal deal push flow.';

COMMENT ON FUNCTION public.create_pipeline_deal(uuid) IS
  'Explicit RPC for creating a deal_pipeline row from a connection request. '
  'Primary use case: portal deal pushes where connection_requests are '
  'INSERTed with status=''approved'' (bypassing the UPDATE trigger). '
  'Deduplicates on connection_request_id — returns existing deal_id if found. '
  'The marketplace approval flow does NOT need to call this — the DB trigger '
  'auto_create_deal_from_approved_connection() handles it automatically.';
