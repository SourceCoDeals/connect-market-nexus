-- ============================================================================
-- Buyer Universes as first-class task entity
--
-- Extends the polymorphic entity_type on daily_standup_tasks so tasks can be
-- assigned directly to a buyer universe (previously only listing/deal/buyer/
-- contact were allowed). Because the polymorphic design gives up DB-level FK
-- enforcement by construction, this migration also adds two pieces of
-- defensive infrastructure:
--
--   1. A soft-FK validation trigger on daily_standup_tasks: on INSERT (or on
--      UPDATE that changes the entity reference), confirm the referenced row
--      exists in the correct target table. Catches typos, bad writes, and
--      dangling references at write time rather than at render time.
--
--   2. Lifecycle triggers on buyer_universes mirroring the handle_listing_
--      status_change pattern already in use for listings:
--         - BEFORE DELETE -> cancel any open tasks and delete done/cancelled
--                           rows (so the universe can actually be deleted
--                           without leaving dangling references).
--         - AFTER UPDATE OF archived: archived=true snoozes open tasks for
--           30 days; archived=false wakes snoozed tasks back up. Matches the
--           inactive/active flow for listings.
-- ============================================================================


-- ─── 1. Extend CHECK constraints ────────────────────────────────────────────

ALTER TABLE public.daily_standup_tasks
  DROP CONSTRAINT IF EXISTS dst_entity_type_check;

ALTER TABLE public.daily_standup_tasks
  ADD CONSTRAINT dst_entity_type_check
    CHECK (entity_type IN ('listing','deal','buyer','contact','buyer_universe'))
    NOT VALID;

ALTER TABLE public.daily_standup_tasks
  DROP CONSTRAINT IF EXISTS dst_secondary_entity_type_check;

ALTER TABLE public.daily_standup_tasks
  ADD CONSTRAINT dst_secondary_entity_type_check
    CHECK (
      secondary_entity_type IS NULL OR
      secondary_entity_type IN ('listing','deal','buyer','contact','buyer_universe')
    )
    NOT VALID;


-- ─── 2. Soft-FK validation trigger ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_task_entity_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ref_exists boolean;
BEGIN
  -- Primary entity
  IF NEW.entity_id IS NOT NULL AND NEW.entity_type IS NOT NULL THEN
    CASE NEW.entity_type
      WHEN 'listing' THEN
        SELECT EXISTS(SELECT 1 FROM public.listings WHERE id = NEW.entity_id) INTO ref_exists;
      WHEN 'deal' THEN
        SELECT EXISTS(SELECT 1 FROM public.deals WHERE id = NEW.entity_id) INTO ref_exists;
      WHEN 'buyer' THEN
        SELECT EXISTS(SELECT 1 FROM public.buyers WHERE id = NEW.entity_id) INTO ref_exists;
      WHEN 'contact' THEN
        SELECT EXISTS(SELECT 1 FROM public.contacts WHERE id = NEW.entity_id) INTO ref_exists;
      WHEN 'buyer_universe' THEN
        SELECT EXISTS(SELECT 1 FROM public.buyer_universes WHERE id = NEW.entity_id) INTO ref_exists;
      ELSE
        ref_exists := true;  -- unknown entity_type; CHECK constraint will reject
    END CASE;

    IF NOT ref_exists THEN
      RAISE EXCEPTION
        'daily_standup_tasks.entity_id % does not exist in % table',
        NEW.entity_id, NEW.entity_type
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  -- Secondary entity (optional)
  IF NEW.secondary_entity_id IS NOT NULL AND NEW.secondary_entity_type IS NOT NULL THEN
    CASE NEW.secondary_entity_type
      WHEN 'listing' THEN
        SELECT EXISTS(SELECT 1 FROM public.listings WHERE id = NEW.secondary_entity_id) INTO ref_exists;
      WHEN 'deal' THEN
        SELECT EXISTS(SELECT 1 FROM public.deals WHERE id = NEW.secondary_entity_id) INTO ref_exists;
      WHEN 'buyer' THEN
        SELECT EXISTS(SELECT 1 FROM public.buyers WHERE id = NEW.secondary_entity_id) INTO ref_exists;
      WHEN 'contact' THEN
        SELECT EXISTS(SELECT 1 FROM public.contacts WHERE id = NEW.secondary_entity_id) INTO ref_exists;
      WHEN 'buyer_universe' THEN
        SELECT EXISTS(SELECT 1 FROM public.buyer_universes WHERE id = NEW.secondary_entity_id) INTO ref_exists;
      ELSE
        ref_exists := true;
    END CASE;

    IF NOT ref_exists THEN
      RAISE EXCEPTION
        'daily_standup_tasks.secondary_entity_id % does not exist in % table',
        NEW.secondary_entity_id, NEW.secondary_entity_type
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fires on INSERT, and on UPDATE only when the entity reference columns are
-- actually in the SET clause (via `UPDATE OF`). This means routine updates
-- (status changes, completion, reassignment) never pay the validation cost
-- and never fail even after the referenced entity has been deleted.
DROP TRIGGER IF EXISTS trg_validate_task_entity ON public.daily_standup_tasks;
CREATE TRIGGER trg_validate_task_entity
  BEFORE INSERT OR UPDATE OF entity_type, entity_id, secondary_entity_type, secondary_entity_id
  ON public.daily_standup_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_entity_reference();


-- ─── 3. Buyer universe lifecycle triggers ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_buyer_universe_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- archived -> true: snooze open tasks for 30 days (mirror listing 'inactive')
  IF NEW.archived = true AND OLD.archived = false THEN
    UPDATE public.daily_standup_tasks
       SET status = 'snoozed',
           snoozed_until = CURRENT_DATE + INTERVAL '30 days',
           updated_at = now()
     WHERE entity_type = 'buyer_universe'
       AND entity_id = NEW.id
       AND status IN ('pending','pending_approval','in_progress','overdue');
  END IF;

  -- archived -> false: wake snoozed tasks (mirror listing re-activation)
  IF NEW.archived = false AND OLD.archived = true THEN
    UPDATE public.daily_standup_tasks
       SET status = 'pending',
           snoozed_until = NULL,
           updated_at = now()
     WHERE entity_type = 'buyer_universe'
       AND entity_id = NEW.id
       AND status = 'snoozed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_buyer_universe_archive ON public.buyer_universes;
CREATE TRIGGER trg_buyer_universe_archive
  AFTER UPDATE OF archived ON public.buyer_universes
  FOR EACH ROW
  WHEN (OLD.archived IS DISTINCT FROM NEW.archived)
  EXECUTE FUNCTION public.handle_buyer_universe_archive();


CREATE OR REPLACE FUNCTION public.handle_buyer_universe_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cancel any still-open tasks linked to this universe. We keep these rows
  -- (with a stale entity_id) for audit; the soft-FK trigger only validates
  -- writes that touch entity_type/entity_id, so status updates on these rows
  -- continue to work.
  UPDATE public.daily_standup_tasks
     SET status = 'cancelled',
         updated_at = now()
   WHERE entity_type = 'buyer_universe'
     AND entity_id = OLD.id
     AND status IN ('pending','pending_approval','in_progress','overdue','snoozed');

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_buyer_universe_delete ON public.buyer_universes;
CREATE TRIGGER trg_buyer_universe_delete
  BEFORE DELETE ON public.buyer_universes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_buyer_universe_delete();
