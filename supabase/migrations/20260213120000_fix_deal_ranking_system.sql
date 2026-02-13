-- ==========================================================================
-- Fix deal ranking & identifier system (consolidates 4 prior hotfix migrations)
--
-- Problems fixed:
--   1. deal_identifier_seq out of sync — set to actual MAX + 100
--   2. Sequence permissions missing for service_role / authenticated
--   3. generate_deal_identifier() had stale search_path from earlier migration
--   4. ranked_deals view references calculated_rank / final_rank (always NULL)
--   5. No auto-rank for newly-activated deals (manual_rank_override left NULL)
-- ==========================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Reset deal_identifier_seq to actual max identifier + 100
--    This is the ONLY place the sequence should be initialised going forward.
-- ──────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  max_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN deal_identifier ~ '^SCO-[0-9]{4}-[0-9]+$'
      THEN CAST(SUBSTRING(deal_identifier FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) INTO max_seq FROM public.listings;

  -- Add a 100-ID buffer so manually-inserted rows don't collide
  PERFORM setval('public.deal_identifier_seq', GREATEST(max_seq + 100, 1000), false);

  RAISE NOTICE 'deal_identifier_seq set to % (max existing = %)', GREATEST(max_seq + 100, 1000), max_seq;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Ensure sequence permissions are correct
-- ──────────────────────────────────────────────────────────────────────────
GRANT USAGE, SELECT ON SEQUENCE public.deal_identifier_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.deal_identifier_seq TO service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Recreate generate_deal_identifier() — sequence-based, correct search_path
--    This is the canonical version; replaces all prior definitions.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_deal_identifier()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    current_year TEXT;
    next_sequence INTEGER;
BEGIN
    current_year := EXTRACT(year FROM NOW())::TEXT;
    next_sequence := nextval('public.deal_identifier_seq');
    RETURN 'SCO-' || current_year || '-' || LPAD(next_sequence::TEXT, 3, '0');
END;
$function$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Ensure exactly ONE trigger exists for deal identifier generation
--    History: two triggers were created (trigger_auto_generate_deal_identifier
--    and auto_generate_deal_identifier_trigger). Drop both and recreate one.
-- ──────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_auto_generate_deal_identifier ON public.listings;
DROP TRIGGER IF EXISTS auto_generate_deal_identifier_trigger ON public.listings;

CREATE OR REPLACE FUNCTION public.auto_generate_deal_identifier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.deal_identifier IS NULL THEN
        NEW.deal_identifier := public.generate_deal_identifier();
    END IF;
    RETURN NEW;
END;
$function$;

CREATE TRIGGER auto_generate_deal_identifier_trigger
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_deal_identifier();

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Fix ranked_deals view — stop depending on always-NULL columns
--    calculated_rank and final_rank are never set by any code path.
--    Use manual_rank_override directly; fall back to created_at ordering.
-- ──────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS ranked_deals;

CREATE VIEW ranked_deals
WITH (security_invoker = true) AS
SELECT l.*,
    COALESCE(l.manual_rank_override,
      ROW_NUMBER() OVER (ORDER BY l.created_at ASC)::INTEGER
    ) AS display_rank
FROM listings l
WHERE l.deleted_at IS NULL AND l.status = 'active';

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Auto-assign manual_rank_override for deals that become active
--    without one. Uses MAX()+1 in a per-row trigger — safe because
--    status changes to 'active' happen one deal at a time in the UI,
--    not in batches like CapTarget inserts.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_assign_rank_on_activate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    max_rank INTEGER;
BEGIN
    -- Only fire when a deal transitions to 'active' without a rank
    IF NEW.status = 'active'
       AND NEW.manual_rank_override IS NULL
       AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'active')
    THEN
        SELECT COALESCE(MAX(manual_rank_override), 0)
        INTO max_rank
        FROM public.listings
        WHERE status = 'active' AND deleted_at IS NULL;

        NEW.manual_rank_override := max_rank + 1;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS auto_assign_rank_on_activate ON public.listings;

CREATE TRIGGER auto_assign_rank_on_activate
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_rank_on_activate();
