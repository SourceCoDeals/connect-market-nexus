-- List operations: merge, subtract, intersect, clone
-- All operations create a NEW list; originals are unchanged.

-- MERGE: union all members from multiple lists, deduplicated by email
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

  -- Create the new list
  INSERT INTO contact_lists (name, list_type, created_by, contact_count)
  VALUES (p_new_name, p_list_type, auth.uid(), 0)
  RETURNING id INTO v_new_list_id;

  -- Insert deduplicated members (most recently added wins)
  WITH ranked AS (
    SELECT DISTINCT ON (contact_email)
      contact_email, contact_name, contact_phone, contact_company,
      contact_role, entity_type, entity_id
    FROM contact_list_members
    WHERE list_id = ANY(p_list_ids) AND removed_at IS NULL
    ORDER BY contact_email, added_at DESC
  )
  INSERT INTO contact_list_members (list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id)
  SELECT v_new_list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id
  FROM ranked;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE contact_lists SET contact_count = v_count WHERE id = v_new_list_id;

  RETURN v_new_list_id;
END;
$$;

-- SUBTRACT: members in primary list that are NOT in any exclude list
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
    contact_company, contact_role, entity_type, entity_id)
  SELECT v_new_list_id, m.contact_email, m.contact_name, m.contact_phone,
    m.contact_company, m.contact_role, m.entity_type, m.entity_id
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

-- INTERSECT: only members that appear in ALL specified lists
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

  -- Find emails that appear in ALL lists, then take data from the first list
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
    contact_company, contact_role, entity_type, entity_id)
  SELECT v_new_list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id
  FROM source_data;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE contact_lists SET contact_count = v_count WHERE id = v_new_list_id;

  RETURN v_new_list_id;
END;
$$;

-- CLONE: duplicate a list with all its active members
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

  INSERT INTO contact_lists (name, description, list_type, tags, created_by, contact_count)
  VALUES (p_new_name, v_source.description, v_source.list_type, v_source.tags, auth.uid(), 0)
  RETURNING id INTO v_new_list_id;

  INSERT INTO contact_list_members (list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id)
  SELECT v_new_list_id, contact_email, contact_name, contact_phone,
    contact_company, contact_role, entity_type, entity_id
  FROM contact_list_members
  WHERE list_id = p_source_id AND removed_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE contact_lists SET contact_count = v_count WHERE id = v_new_list_id;

  RETURN v_new_list_id;
END;
$$;

COMMENT ON FUNCTION merge_lists IS 'Merge multiple lists into a new list, deduplicating by email';
COMMENT ON FUNCTION subtract_lists IS 'Create a new list from primary minus exclude lists';
COMMENT ON FUNCTION intersect_lists IS 'Create a new list with only members in ALL specified lists';
COMMENT ON FUNCTION clone_list IS 'Duplicate a list with all active members';
