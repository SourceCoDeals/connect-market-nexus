-- Smart List / List-Combine audit fixes
-- Covers: H1 (cron schedule), M3 (clone preserves smart fields),
-- M8 (trigger search_path), L2 (added_by in combine RPCs).

-- ------------------------------------------------------------
-- H1: Schedule process-smart-list-queue to run every 5 minutes.
-- Matches the pattern in 20260315000001_fix_hardcoded_service_keys.sql
-- using app.settings.supabase_url / service_role_key GUCs.
-- ------------------------------------------------------------
SELECT cron.schedule(
  'process-smart-list-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-smart-list-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'apikey', current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('triggered_at', now()::text)
  ) AS request_id;
  $$
);

-- ------------------------------------------------------------
-- M8: Add SET search_path to queue trigger functions.
-- The functions are SECURITY DEFINER and should pin search_path
-- to 'public' for the same safety reasons as other admin RPCs.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_smart_list_evaluation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM contact_lists
    WHERE is_smart_list = TRUE AND is_archived = FALSE
      AND auto_add_enabled = TRUE AND source_entity = 'listings'
    LIMIT 1
  ) THEN
    INSERT INTO smart_list_evaluation_queue (listing_id, queued_at)
    VALUES (NEW.id, now())
    ON CONFLICT (listing_id) DO UPDATE SET queued_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_smart_list_buyer_evaluation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM contact_lists
    WHERE is_smart_list = TRUE AND is_archived = FALSE
      AND auto_add_enabled = TRUE AND source_entity = 'remarketing_buyers'
    LIMIT 1
  ) THEN
    INSERT INTO smart_list_buyer_evaluation_queue (buyer_id, queued_at)
    VALUES (NEW.id, now())
    ON CONFLICT (buyer_id) DO UPDATE SET queued_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- L2: Allow 'merged' and 'cloned' as added_by values so combine
-- RPCs can tag their provenance instead of defaulting to 'manual'.
-- ------------------------------------------------------------
ALTER TABLE public.contact_list_members
  DROP CONSTRAINT IF EXISTS contact_list_members_added_by_check;

ALTER TABLE public.contact_list_members
  ADD CONSTRAINT contact_list_members_added_by_check
  CHECK (added_by IN ('manual', 'smart_rule', 'import', 'merged', 'cloned'));

-- ------------------------------------------------------------
-- M3 + L2: Rewrite combine RPCs to preserve smart-list identity
-- on clone, and tag provenance on all combine outputs.
-- ------------------------------------------------------------

-- MERGE: union all members from multiple lists, deduplicated by email.
-- Tagged as 'merged'.
CREATE OR REPLACE FUNCTION public.merge_lists(
  p_list_ids uuid[],
  p_new_name text,
  p_list_type text DEFAULT 'mixed'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_list_id uuid;
  v_count int;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can merge lists';
  END IF;

  INSERT INTO contact_lists (name, list_type, created_by, contact_count)
  VALUES (p_new_name, p_list_type, auth.uid(), 0)
  RETURNING id INTO v_new_list_id;

  WITH ranked AS (
    SELECT DISTINCT ON (contact_email)
      contact_email, contact_name, contact_phone, contact_company,
      contact_role, entity_type, entity_id
    FROM contact_list_members
    WHERE list_id = ANY(p_list_ids) AND removed_at IS NULL
    ORDER BY contact_email, added_at DESC
  )
  INSERT INTO contact_list_members (list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id, added_by)
  SELECT v_new_list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id, 'merged'
  FROM ranked;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE contact_lists SET contact_count = v_count WHERE id = v_new_list_id;

  RETURN v_new_list_id;
END;
$$;

-- SUBTRACT: members in primary list that are NOT in any exclude list.
-- Tagged as 'merged' (derived from existing lists).
CREATE OR REPLACE FUNCTION public.subtract_lists(
  p_primary_id uuid,
  p_exclude_ids uuid[],
  p_new_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_list_id uuid;
  v_count int;
  v_list_type text;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can subtract lists';
  END IF;

  SELECT list_type INTO v_list_type FROM contact_lists WHERE id = p_primary_id;

  INSERT INTO contact_lists (name, list_type, created_by, contact_count)
  VALUES (p_new_name, COALESCE(v_list_type, 'mixed'), auth.uid(), 0)
  RETURNING id INTO v_new_list_id;

  INSERT INTO contact_list_members (list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id, added_by)
  SELECT v_new_list_id, m.contact_email, m.contact_name, m.contact_phone,
    m.contact_company, m.contact_role, m.entity_type, m.entity_id, 'merged'
  FROM contact_list_members m
  WHERE m.list_id = p_primary_id AND m.removed_at IS NULL
    AND m.contact_email NOT IN (
      SELECT ex.contact_email
      FROM contact_list_members ex
      WHERE ex.list_id = ANY(p_exclude_ids) AND ex.removed_at IS NULL
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE contact_lists SET contact_count = v_count WHERE id = v_new_list_id;

  RETURN v_new_list_id;
END;
$$;

-- INTERSECT: only members that appear in ALL specified lists.
-- Tagged as 'merged'.
CREATE OR REPLACE FUNCTION public.intersect_lists(
  p_list_ids uuid[],
  p_new_name text,
  p_list_type text DEFAULT 'mixed'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_list_id uuid;
  v_count int;
  v_list_count int;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can intersect lists';
  END IF;

  v_list_count := array_length(p_list_ids, 1);

  INSERT INTO contact_lists (name, list_type, created_by, contact_count)
  VALUES (p_new_name, p_list_type, auth.uid(), 0)
  RETURNING id INTO v_new_list_id;

  WITH common_emails AS (
    SELECT contact_email
    FROM contact_list_members
    WHERE list_id = ANY(p_list_ids) AND removed_at IS NULL
    GROUP BY contact_email
    HAVING count(DISTINCT list_id) = v_list_count
  ),
  source_data AS (
    SELECT DISTINCT ON (m.contact_email)
      m.contact_email, m.contact_name, m.contact_phone, m.contact_company,
      m.contact_role, m.entity_type, m.entity_id
    FROM contact_list_members m
    JOIN common_emails ce ON m.contact_email = ce.contact_email
    WHERE m.list_id = p_list_ids[1] AND m.removed_at IS NULL
    ORDER BY m.contact_email
  )
  INSERT INTO contact_list_members (list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id, added_by)
  SELECT v_new_list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id, 'merged'
  FROM source_data;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE contact_lists SET contact_count = v_count WHERE id = v_new_list_id;

  RETURN v_new_list_id;
END;
$$;

-- CLONE: duplicate a list with all its active members.
-- M3: preserves is_smart_list / list_rules / match_mode / source_entity /
-- auto_add_enabled so cloning a smart list yields another smart list.
-- L2: tags cloned members as 'cloned'.
CREATE OR REPLACE FUNCTION public.clone_list(
  p_source_id uuid,
  p_new_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_list_id uuid;
  v_count int;
  v_source record;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can clone lists';
  END IF;

  SELECT * INTO v_source FROM contact_lists WHERE id = p_source_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source list not found';
  END IF;

  INSERT INTO contact_lists (
    name, description, list_type, tags, created_by, contact_count,
    is_smart_list, list_rules, match_mode, source_entity, auto_add_enabled
  )
  VALUES (
    p_new_name, v_source.description, v_source.list_type, v_source.tags,
    auth.uid(), 0,
    v_source.is_smart_list, v_source.list_rules, v_source.match_mode,
    v_source.source_entity, v_source.auto_add_enabled
  )
  RETURNING id INTO v_new_list_id;

  INSERT INTO contact_list_members (list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id, added_by)
  SELECT v_new_list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id, 'cloned'
  FROM contact_list_members
  WHERE list_id = p_source_id AND removed_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE contact_lists SET contact_count = v_count WHERE id = v_new_list_id;

  RETURN v_new_list_id;
END;
$$;

COMMENT ON FUNCTION merge_lists IS 'Merge multiple lists into a new list, deduped by email; members tagged added_by=merged';
COMMENT ON FUNCTION subtract_lists IS 'Create a new list from primary minus exclude lists; members tagged added_by=merged';
COMMENT ON FUNCTION intersect_lists IS 'Create a new list with only members in ALL specified lists; members tagged added_by=merged';
COMMENT ON FUNCTION clone_list IS 'Duplicate a list with all active members, preserving smart-list rules if source is smart; members tagged added_by=cloned';
