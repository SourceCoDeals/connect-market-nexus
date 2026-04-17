-- =============================================================================
-- Contact last-call rollup
-- =============================================================================
-- `contacts` has five denormalized rollup columns that summarize the contact's
-- most recent PhoneBurner activity:
--   - last_call_attempt_at
--   - last_call_connected_at
--   - last_disposition_code
--   - last_disposition_label
--   - last_disposition_date
--
-- None of them were being populated. The contact card has no "last call
-- outcome" signal, and Alia has no fast way to see "did anyone on my team
-- just call this person?" without opening the timeline.
--
-- Fix: trigger on contact_activities (INSERT or UPDATE of contact_id /
-- call_outcome / disposition_* / call_ended_at) that rolls the MAX call-side
-- signal back onto the contacts row. Scoped to source_system='phoneburner'
-- to avoid polluting these fields with non-call activity.
--
-- The trigger is AFTER INSERT OR UPDATE, narrow WHEN clause, and uses a
-- single UPDATE with aggregate subqueries so it's idempotent (recomputes
-- from the full activity history each fire — O(1) per contact given
-- the existing idx_ca_contact_id index).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refresh_contact_call_rollup(p_contact_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_contact_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE contacts c SET
    last_call_attempt_at = sub.attempt_at,
    last_call_connected_at = sub.connected_at,
    last_disposition_code = sub.disposition_code,
    last_disposition_label = sub.disposition_label,
    last_disposition_date = sub.disposition_date
  FROM (
    SELECT
      max(ca.call_started_at) FILTER (WHERE ca.call_started_at IS NOT NULL) AS attempt_at,
      max(ca.call_connected_at) FILTER (WHERE ca.call_connected = true) AS connected_at,
      (array_agg(ca.disposition_code ORDER BY ca.disposition_set_at DESC NULLS LAST)
        FILTER (WHERE ca.disposition_code IS NOT NULL))[1] AS disposition_code,
      (array_agg(ca.disposition_label ORDER BY ca.disposition_set_at DESC NULLS LAST)
        FILTER (WHERE ca.disposition_label IS NOT NULL))[1] AS disposition_label,
      max(ca.disposition_set_at) FILTER (WHERE ca.disposition_set_at IS NOT NULL) AS disposition_date
    FROM contact_activities ca
    WHERE ca.contact_id = p_contact_id
      AND ca.source_system = 'phoneburner'
  ) sub
  WHERE c.id = p_contact_id;
END;
$$;

COMMENT ON FUNCTION public.refresh_contact_call_rollup(UUID) IS
  'Recomputes contacts.last_call_* and last_disposition_* rollup columns '
  'from the full contact_activities history for a single contact. Called '
  'from trg_contact_activities_call_rollup. Idempotent.';

GRANT EXECUTE ON FUNCTION public.refresh_contact_call_rollup(UUID) TO authenticated, service_role;


-- Trigger: fire on INSERT, and on UPDATE of the fields that affect the rollup
CREATE OR REPLACE FUNCTION public.trg_contact_activities_call_rollup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_contact UUID := COALESCE(NEW.contact_id, NULL);
  v_old_contact UUID := CASE WHEN TG_OP = 'UPDATE' THEN OLD.contact_id ELSE NULL END;
BEGIN
  -- Fire for the new contact (if any)
  IF v_new_contact IS NOT NULL THEN
    BEGIN
      PERFORM public.refresh_contact_call_rollup(v_new_contact);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'refresh_contact_call_rollup failed for % — %', v_new_contact, SQLERRM;
    END;
  END IF;

  -- If UPDATE rewrote contact_id, refresh the old contact too so its rollup
  -- reflects the loss of this activity row.
  IF v_old_contact IS NOT NULL AND v_old_contact IS DISTINCT FROM v_new_contact THEN
    BEGIN
      PERFORM public.refresh_contact_call_rollup(v_old_contact);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'refresh_contact_call_rollup failed for % — %', v_old_contact, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_activities_call_rollup ON public.contact_activities;
CREATE TRIGGER contact_activities_call_rollup
  AFTER INSERT OR UPDATE OF
    contact_id, call_outcome, call_connected,
    disposition_code, disposition_label, disposition_set_at,
    call_started_at, call_connected_at
  ON public.contact_activities
  FOR EACH ROW
  WHEN (NEW.source_system = 'phoneburner')
  EXECUTE FUNCTION public.trg_contact_activities_call_rollup();

COMMENT ON TRIGGER contact_activities_call_rollup ON public.contact_activities IS
  'Keeps contacts.last_call_* / last_disposition_* in sync with the '
  'contact_activities history. Fires on insert and on updates that affect '
  'the rollup signals.';


-- One-time backfill: recompute rollup for every contact that has at least
-- one phoneburner activity row. Fast — bounded by distinct contact count,
-- not activity count.
DO $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT contact_id
    FROM contact_activities
    WHERE source_system = 'phoneburner'
      AND contact_id IS NOT NULL
  LOOP
    PERFORM public.refresh_contact_call_rollup(r.contact_id);
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Backfilled last-call rollup for % contacts', v_count;
END $$;
