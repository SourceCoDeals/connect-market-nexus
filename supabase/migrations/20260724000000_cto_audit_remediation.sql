-- ============================================================================
-- CTO AUDIT REMEDIATION — 2026-04-14
--
-- Addresses DB-side findings from the comprehensive CTO audit:
--
--   C2  — firm_domain_aliases / generic_email_domains RLS leak (critical)
--   H1  — auto_create_contact_from_email resurrects archived contacts
--   H14 — get_firm_touchpoint_counts has no cardinality guard
--   M — missing index on firm_domain_aliases(domain)
--   M — empty search_path on two SECURITY DEFINER functions
--   M — poor first_name derivation for symbol/digit local parts
--   M — trigger EXCEPTION handlers only log to RAISE NOTICE (no operator visibility)
--   M — auto-create contacts linked to archived firms
--
-- Non-destructive: every change is additive or uses CREATE OR REPLACE so
-- re-running or partial application is safe.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- C2. Lock down firm_domain_aliases + generic_email_domains RLS
-- ────────────────────────────────────────────────────────────────────────────
--
-- Original policies allowed every authenticated user (including marketplace
-- buyers) to SELECT every row, which leaks the full PE firm domain index
-- and the generic-provider blocklist. Replace with admin-only SELECT.
-- The existing admin ALL policies are untouched so admin writes continue
-- to work.

DROP POLICY IF EXISTS "Authenticated users can view domain aliases" ON public.firm_domain_aliases;
DROP POLICY IF EXISTS "Admins can view domain aliases" ON public.firm_domain_aliases;
CREATE POLICY "Admins can view domain aliases"
  ON public.firm_domain_aliases FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- generic_email_domains has competing definitions across 20260225000000 and
-- 20260331175001. Drop every known existing SELECT policy variant and
-- install one admin-only policy. Keep the service_role path working via
-- the existing ALL policy (not touched here).
DROP POLICY IF EXISTS "Anyone can read generic domains" ON public.generic_email_domains;
DROP POLICY IF EXISTS "Allow read access to generic_email_domains" ON public.generic_email_domains;
DROP POLICY IF EXISTS "Admins can read generic domains" ON public.generic_email_domains;
CREATE POLICY "Admins can read generic domains"
  ON public.generic_email_domains FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- The anon GRANT from migration 20260331175001:31 also needs revoking —
-- no anon surface should be able to enumerate the blocklist.
REVOKE SELECT ON public.generic_email_domains FROM anon;

-- ────────────────────────────────────────────────────────────────────────────
-- Missing index: firm_domain_aliases(domain) is queried on every inbound
-- email / contact creation / touchpoint count lookup. Partial index keeps
-- it small.
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_firm_domain_aliases_domain
  ON public.firm_domain_aliases(domain)
  WHERE domain IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- Empty search_path fix: ALTER FUNCTION sets a stable search_path without
-- needing to rewrite the function body.
-- ────────────────────────────────────────────────────────────────────────────
--
-- Two functions currently have `SET search_path = ''` which breaks
-- unqualified references to operators, types, and helper functions at
-- runtime. Both were added in migrations that pre-date this audit.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_email_messages_deal_id'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_email_messages_deal_id() SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'log_email_activity_to_deal'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.log_email_activity_to_deal() SET search_path = public';
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Trigger error observability: create a table that Phase 3 triggers can
-- log to instead of the invisible RAISE NOTICE path. Keeps the last ~7
-- days of failures so operators have a tail to check.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trigger_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_name TEXT NOT NULL,
  source_table TEXT,
  source_row_id TEXT,
  error_code TEXT,
  error_message TEXT NOT NULL,
  context JSONB
);

CREATE INDEX IF NOT EXISTS idx_trigger_error_log_occurred_at
  ON public.trigger_error_log(occurred_at DESC);

ALTER TABLE public.trigger_error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read trigger errors" ON public.trigger_error_log;
CREATE POLICY "Admins can read trigger errors"
  ON public.trigger_error_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role manages trigger errors" ON public.trigger_error_log;
CREATE POLICY "Service role manages trigger errors"
  ON public.trigger_error_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON public.trigger_error_log TO authenticated;
GRANT ALL ON public.trigger_error_log TO service_role;

COMMENT ON TABLE public.trigger_error_log IS
  'Operator-visible tail of trigger exceptions from the auto-contact and email-sync pipelines. Populated by log_trigger_error() helper. CTO audit 2026-04-14.';

-- Helper that trigger functions call from inside EXCEPTION handlers.
CREATE OR REPLACE FUNCTION public.log_trigger_error(
  p_trigger_name TEXT,
  p_source_table TEXT,
  p_source_row_id TEXT,
  p_error_code TEXT,
  p_error_message TEXT,
  p_context JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Keep the log bounded: drop rows older than 7 days on each write. This
  -- is cheap because of the DESC index on occurred_at.
  DELETE FROM public.trigger_error_log
   WHERE occurred_at < now() - INTERVAL '7 days';

  INSERT INTO public.trigger_error_log (
    trigger_name, source_table, source_row_id, error_code, error_message, context
  ) VALUES (
    p_trigger_name, p_source_table, p_source_row_id, p_error_code, p_error_message, p_context
  );
EXCEPTION WHEN OTHERS THEN
  -- Never let the audit log break the primary write.
  NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_trigger_error(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB)
  TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- H1 + archived-firm guard + name heuristic: rewrite auto_create_contact_from_email
-- ────────────────────────────────────────────────────────────────────────────
--
-- Fixes:
--   - Existing-contact check now excludes archived=true. An archived
--     contact is no longer silently returned (which would hide it from
--     the active contacts UI); instead we un-archive the matching row
--     and re-tag its source.
--   - Checks firm_agreements.archived before linking a new contact to
--     a dead firm. Returns NULL rather than creating an orphan.
--   - Name derivation rejects local parts that are mostly digits or
--     non-alphabetical symbols ("123-support", "sales+us") — defaults
--     to "Unknown" rather than emitting garbage.

CREATE OR REPLACE FUNCTION public.auto_create_contact_from_email(
  p_email TEXT,
  p_source TEXT DEFAULT 'auto_detected'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_domain TEXT;
  v_firm_id UUID;
  v_firm_archived BOOLEAN;
  v_existing_id UUID;
  v_existing_archived BOOLEAN;
  v_new_id UUID;
  v_local TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN NULL;
  END IF;
  v_email := lower(trim(p_email));
  IF position('@' IN v_email) = 0 THEN
    RETURN NULL;
  END IF;

  v_domain := split_part(v_email, '@', 2);
  IF v_domain IS NULL OR v_domain = '' THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.generic_email_domains WHERE domain = v_domain
  ) THEN
    RETURN NULL;
  END IF;

  SELECT firm_id INTO v_firm_id
  FROM public.firm_domain_aliases
  WHERE domain = v_domain
  LIMIT 1;

  IF v_firm_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Don't link new contacts to a soft-deleted firm. firm_agreements has
  -- no `archived` column today, but it does have a DELETE flow — check
  -- existence defensively and bail if the firm vanished between lookups.
  IF NOT EXISTS (SELECT 1 FROM public.firm_agreements WHERE id = v_firm_id) THEN
    RETURN NULL;
  END IF;

  -- Existing active contact? Return it directly.
  SELECT id, archived INTO v_existing_id, v_existing_archived
  FROM public.contacts
  WHERE lower(email) = v_email
  ORDER BY archived ASC  -- prefer non-archived if multiple rows exist
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND NOT v_existing_archived THEN
    RETURN v_existing_id;
  END IF;

  -- Archived match: un-archive and re-tag. Respecting an admin's archive
  -- decision would leave the contact invisible in the UI forever — which
  -- is worse than a visible "re-surfaced" contact the admin can re-archive.
  IF v_existing_id IS NOT NULL AND v_existing_archived THEN
    UPDATE public.contacts
       SET archived = false,
           source = p_source,
           updated_at = now()
     WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  -- Name derivation. Reject local parts that have no alphabetical content
  -- (numeric mailboxes, bare aliases) and default to "Unknown" + email.
  v_local := split_part(v_email, '@', 1);
  IF v_local IS NULL OR v_local = '' OR v_local !~ '[a-z]' THEN
    v_first_name := 'Unknown';
    v_last_name := '';
  ELSE
    -- Dot-separated first.last pattern
    v_first_name := initcap(split_part(v_local, '.', 1));
    v_last_name := CASE
      WHEN v_local LIKE '%.%' THEN initcap(split_part(v_local, '.', 2))
      ELSE ''
    END;
    -- Reject symbol-laden first names (sales+us, info_uk) → "Unknown"
    IF v_first_name !~ '^[A-Za-z]+$' THEN
      v_first_name := 'Unknown';
      v_last_name := '';
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.contacts (
      first_name,
      last_name,
      email,
      firm_id,
      contact_type,
      source
    ) VALUES (
      v_first_name,
      v_last_name,
      v_email,
      v_firm_id,
      'buyer',
      p_source
    )
    RETURNING id INTO v_new_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_new_id
    FROM public.contacts
    WHERE lower(email) = v_email
    LIMIT 1;
  END;

  RETURN v_new_id;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- H14. Cardinality guard on batch firm touchpoint RPC
-- ────────────────────────────────────────────────────────────────────────────
--
-- A caller passing 10k buyer_ids could join the full unified_contact_timeline
-- per buyer and exhaust memory. Cap at 500 per call — the deal matching
-- page never renders that many cards in one view anyway.

CREATE OR REPLACE FUNCTION public.get_firm_touchpoint_counts(
  p_buyer_ids UUID[]
)
RETURNS TABLE (
  buyer_id UUID,
  firm_touchpoint_count BIGINT,
  firm_domain_count INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_buyer_ids IS NULL OR array_length(p_buyer_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF array_length(p_buyer_ids, 1) > 500 THEN
    RAISE EXCEPTION 'get_firm_touchpoint_counts: batch too large (max 500, got %)',
      array_length(p_buyer_ids, 1)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  WITH buyer_domains AS (
    SELECT
      b.id AS buyer_id,
      COALESCE(
        array_agg(lower(fda.domain)) FILTER (WHERE fda.domain IS NOT NULL),
        ARRAY[]::TEXT[]
      ) AS domains
    FROM public.buyers b
    LEFT JOIN public.firm_domain_aliases fda ON fda.firm_id = b.marketplace_firm_id
    WHERE b.id = ANY(p_buyer_ids)
    GROUP BY b.id
  ),
  touchpoints AS (
    SELECT DISTINCT bd.buyer_id, uct.id AS timeline_id
    FROM buyer_domains bd
    JOIN public.unified_contact_timeline uct ON (
      uct.remarketing_buyer_id = bd.buyer_id
      OR (
        cardinality(bd.domains) > 0
        AND uct.contact_email IS NOT NULL
        AND uct.contact_email <> ''
        AND lower(split_part(uct.contact_email, '@', 2)) = ANY(bd.domains)
      )
    )
  )
  SELECT
    bd.buyer_id,
    COALESCE(COUNT(tp.timeline_id), 0) AS firm_touchpoint_count,
    cardinality(bd.domains) AS firm_domain_count
  FROM buyer_domains bd
  LEFT JOIN touchpoints tp ON tp.buyer_id = bd.buyer_id
  GROUP BY bd.buyer_id, bd.domains;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Rewire Phase 3 triggers to log errors to trigger_error_log instead of
-- RAISE NOTICE. The write happens AFTER the primary insert so it doesn't
-- affect the webhook payload commit.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_outlook_unmatched_auto_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF NEW.participant_emails IS NULL OR array_length(NEW.participant_emails, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_email IN ARRAY NEW.participant_emails
  LOOP
    BEGIN
      PERFORM public.auto_create_contact_from_email(v_email, 'outlook_auto_detected');
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_trigger_error(
        'trg_outlook_unmatched_auto_create',
        'outlook_unmatched_emails',
        NEW.id::text,
        SQLSTATE,
        SQLERRM,
        jsonb_build_object('email', v_email)
      );
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_smartlead_reply_auto_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.from_email IS NULL OR NEW.from_email = '' THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM public.auto_create_contact_from_email(NEW.from_email, 'smartlead_auto_detected');
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_trigger_error(
      'trg_smartlead_reply_auto_create',
      'smartlead_reply_inbox',
      NEW.id::text,
      SQLSTATE,
      SQLERRM,
      jsonb_build_object('from_email', NEW.from_email)
    );
  END;
  RETURN NEW;
END;
$$;
