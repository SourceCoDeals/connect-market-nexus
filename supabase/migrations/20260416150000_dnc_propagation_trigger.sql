-- =============================================================================
-- DNC propagation: contacts.do_not_call → smartlead_campaign_leads
-- =============================================================================
-- When PhoneBurner webhook or a user toggles contacts.do_not_call=true, the
-- contact should stop receiving automated outreach. Previously the flag was
-- written to contacts but never reflected in the outreach integrations, so the
-- next Smartlead send would still fire.
--
-- This trigger closes the local loop by marking every smartlead_campaign_leads
-- row for that email as do_not_call. The Smartlead-API-side pause is a
-- separate step (requires an HTTP call from an edge function with Smartlead
-- credentials) — done by queueing a row in dnc_propagation_queue so a future
-- sync worker can pick it up. Keeping the queue explicit means the trigger
-- stays synchronous-safe (no HTTP from triggers) and failures are observable.
-- =============================================================================

-- Queue table consumed by a future sync worker (propagate-dnc). Admins can
-- see pending rows and retry. Kept as a normal table so RLS + service-role
-- writes work the same as the outreach unmatched queues.
CREATE TABLE IF NOT EXISTS public.dnc_propagation_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  contact_email    TEXT,
  linkedin_url     TEXT,
  target_systems   TEXT[] NOT NULL DEFAULT ARRAY['smartlead','heyreach','phoneburner']::TEXT[],
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dnc_queue_pending
  ON public.dnc_propagation_queue(created_at DESC)
  WHERE status = 'pending';

ALTER TABLE public.dnc_propagation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage dnc_propagation_queue" ON public.dnc_propagation_queue;
CREATE POLICY "Admins manage dnc_propagation_queue"
  ON public.dnc_propagation_queue FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT ALL ON public.dnc_propagation_queue TO service_role;


-- ── Local propagation: smartlead_campaign_leads ─────────────────────────────
CREATE OR REPLACE FUNCTION public.propagate_dnc_local(p_contact_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT lower(trim(email)) INTO v_email FROM contacts WHERE id = p_contact_id;
  IF v_email IS NULL OR length(v_email) = 0 THEN
    RETURN;
  END IF;

  -- smartlead_campaign_leads is matched on email (smartlead's own PK is
  -- smartlead_lead_id which we don't always have). Updating every row for
  -- this email is idempotent. The status VALUE is 'do_not_contact' —
  -- Smartlead's local vocabulary for their DNC category — even though the
  -- contacts column is do_not_call. Keeping these intentionally separate:
  -- the boolean on contacts tracks the CRM-side flag, the string on
  -- smartlead_campaign_leads tracks Smartlead's category.
  UPDATE smartlead_campaign_leads
    SET lead_status = 'do_not_contact',
        lead_category = 'do_not_contact',
        last_activity_at = now()
    WHERE lower(email) = v_email
      AND (lead_status IS DISTINCT FROM 'do_not_contact'
           OR lead_category IS DISTINCT FROM 'do_not_contact');
END;
$$;

COMMENT ON FUNCTION public.propagate_dnc_local(UUID) IS
  'Mirrors a contact DNC toggle into the local smartlead_campaign_leads '
  'tracking table. Upstream sync (Smartlead API pause) happens via the '
  'dnc_propagation_queue + propagate-dnc edge function (separate path).';

GRANT EXECUTE ON FUNCTION public.propagate_dnc_local(UUID) TO authenticated, service_role;


-- ── Trigger on contacts ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_contact_dnc_propagate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only fire when do_not_call transitioned FROM false/NULL TO true.
  -- (Turning it back to false doesn't auto-reinstate — that has to be
  -- explicit because un-doing a DNC should be deliberate.)
  IF NEW.do_not_call = TRUE
     AND (OLD.do_not_call IS DISTINCT FROM TRUE) THEN
    BEGIN
      PERFORM public.propagate_dnc_local(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'propagate_dnc_local failed for % — %', NEW.id, SQLERRM;
    END;

    -- Queue upstream API pauses for a future propagate-dnc worker.
    BEGIN
      INSERT INTO dnc_propagation_queue (contact_id, contact_email, linkedin_url)
      VALUES (NEW.id, NEW.email, NEW.linkedin_url);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'dnc_propagation_queue insert failed for % — %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_dnc_propagate ON public.contacts;
CREATE TRIGGER contacts_dnc_propagate
  AFTER UPDATE OF do_not_call ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_contact_dnc_propagate();

COMMENT ON TRIGGER contacts_dnc_propagate ON public.contacts IS
  'When a contact is marked do_not_call=true, mirror to local tracking '
  'tables and queue upstream integration pauses.';
