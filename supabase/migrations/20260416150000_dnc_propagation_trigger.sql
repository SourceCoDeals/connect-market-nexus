-- ============================================================================
-- DNC propagation: contacts.do_not_call → smartlead_campaign_leads
-- ============================================================================
-- When PhoneBurner webhook or a user toggles contacts.do_not_call = TRUE,
-- mirror the DNC status locally so Smartlead campaigns skip that email,
-- and enqueue an async job to pause the lead on Smartlead's side.
--
-- HISTORY:
-- The original 2026-04-16 version of this migration referenced a
-- `do_not_contact` column that never existed in prod (prod has
-- `do_not_call`). It failed to apply during the 2026-04-20 sync and was
-- marked-as-applied without running. Meanwhile a corrected version of
-- the same objects had already been built against prod directly — we
-- confirmed 2026-04-20 that `trg_contact_dnc_propagate`,
-- `contacts_dnc_propagate`, `propagate_dnc_local`, and
-- `dnc_propagation_queue` all exist and use `do_not_call`. This file is
-- a rewrite that matches prod so a future DR / fresh replay produces
-- the same state. All statements are idempotent (IF [NOT] EXISTS,
-- CREATE OR REPLACE) — safe against the already-live objects.
-- ============================================================================

-- ─── 1. Async-propagate queue ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dnc_propagation_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  contact_email    TEXT,
  linkedin_url     TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts         INT NOT NULL DEFAULT 0,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dnc_queue_pending
  ON public.dnc_propagation_queue(created_at)
  WHERE status = 'pending';

ALTER TABLE public.dnc_propagation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage dnc_propagation_queue" ON public.dnc_propagation_queue;
CREATE POLICY "Admins manage dnc_propagation_queue" ON public.dnc_propagation_queue
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- ─── 2. Local DNC mirror into smartlead_campaign_leads ────────────────────

CREATE OR REPLACE FUNCTION public.propagate_dnc_local(p_contact_id UUID)
RETURNS void
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

  UPDATE smartlead_campaign_leads
    SET lead_status      = 'do_not_contact',
        lead_category    = 'do_not_contact',
        last_activity_at = now()
    WHERE lower(email) = v_email
      AND (lead_status IS DISTINCT FROM 'do_not_contact'
           OR lead_category IS DISTINCT FROM 'do_not_contact');
END;
$$;


-- ─── 3. Trigger function — fires on do_not_call transition to TRUE ────────

CREATE OR REPLACE FUNCTION public.trg_contact_dnc_propagate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Fire when do_not_call transitions false/NULL -> true.
  IF NEW.do_not_call = TRUE
     AND (OLD.do_not_call IS DISTINCT FROM TRUE) THEN
    BEGIN
      PERFORM public.propagate_dnc_local(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'propagate_dnc_local failed for % — %', NEW.id, SQLERRM;
    END;

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


-- ─── 4. Trigger on contacts ──────────────────────────────────────────────

DROP TRIGGER IF EXISTS contacts_dnc_propagate ON public.contacts;
CREATE TRIGGER contacts_dnc_propagate
  AFTER UPDATE OF do_not_call ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_contact_dnc_propagate();
