-- ============================================================================
-- CLEANUP: Drop orphaned deal creation functions and clarify deal pipeline
-- ============================================================================
--
-- Context: The `deals` table was renamed to `deal_pipeline` in migration
-- 20260506000000. Over multiple phases, several trigger functions were
-- created, rewritten, and superseded — leaving orphaned functions that
-- exist in the database but have NO trigger bound to them.
--
-- This migration drops the dead functions and documents the canonical
-- deal creation flow:
--
--   1. Buyer submits connection request → NO deal created (INSERT trigger
--      was dropped in 20251006174137).
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
-- ============================================================================

-- ── 1. Drop orphaned function: create_deal_from_connection_request ─────────
-- Originally the INSERT trigger function (20250829140751). The trigger was
-- dropped in 20251006174137, but the function was rewritten in 20260506200000
-- and left behind. No trigger references it.
DROP FUNCTION IF EXISTS public.create_deal_from_connection_request() CASCADE;

-- ── 2. Drop orphaned function: create_deal_on_request_approval ────────────
-- Created in Phase 5 (20260626000000) as a rewrite, but no trigger was ever
-- created for it. The active trigger calls `auto_create_deal_from_approved_connection()`.
DROP FUNCTION IF EXISTS public.create_deal_on_request_approval() CASCADE;

-- ── 3. Drop orphaned function: create_deal_from_inbound_lead ──────────────
-- The inbound lead → deal flow now goes through convert_inbound_lead_to_request
-- → connection_request → approval trigger. This standalone function has no
-- active trigger.
DROP FUNCTION IF EXISTS public.create_deal_from_inbound_lead() CASCADE;

-- ── 4. Add clarifying comment to the ACTIVE trigger function ──────────────
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
