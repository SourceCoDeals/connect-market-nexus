-- ============================================================
-- AI Task Management System — v3.0 Audit Fixes
-- Fixes: listings status constraint, DELETE RLS, search_path,
--        WITH CHECK clauses, entity name resolution view,
--        atomic template creation RPC
-- ============================================================

-- 1. Expand listings status CHECK constraint to support deal lifecycle statuses
-- Current constraint only allows: 'active', 'inactive', 'pending', 'sold'
-- Deal lifecycle trigger needs: 'closed', 'withdrawn', 'dead', 'on_hold'
DO $$
BEGIN
  -- Drop the old constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_listings_status_valid'
  ) THEN
    ALTER TABLE public.listings DROP CONSTRAINT chk_listings_status_valid;
  END IF;

  -- Add expanded constraint
  ALTER TABLE public.listings
    ADD CONSTRAINT chk_listings_status_valid
    CHECK (status IN ('active', 'inactive', 'pending', 'sold', 'closed', 'withdrawn', 'dead', 'on_hold'));
END;
$$;

-- 2. Add DELETE RLS policy for task owners
-- Previously only admins could delete; now task owners can delete their own tasks
CREATE POLICY "owner_delete_rm_tasks"
  ON rm_tasks FOR DELETE
  USING (owner_id = auth.uid() OR created_by = auth.uid());

-- 3. Recreate SECURITY DEFINER functions WITH search_path set
-- Prevents search_path manipulation attacks

CREATE OR REPLACE FUNCTION rm_tasks_deal_lifecycle_hook()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Deal closed/sold → mark tasks as deal_closed
    IF NEW.status IN ('closed', 'sold') THEN
      UPDATE rm_tasks
      SET status = 'deal_closed', updated_at = now()
      WHERE entity_type = 'deal'
        AND entity_id = NEW.id
        AND status IN ('open', 'in_progress');
    END IF;

    -- Deal withdrawn/dead → cancel tasks
    IF NEW.status IN ('withdrawn', 'dead') THEN
      UPDATE rm_tasks
      SET status = 'cancelled', updated_at = now()
      WHERE entity_type = 'deal'
        AND entity_id = NEW.id
        AND status IN ('open', 'in_progress');
    END IF;

    -- Deal on hold → snooze tasks for 30 days
    IF NEW.status = 'on_hold' THEN
      UPDATE rm_tasks
      SET status = 'snoozed',
          snoozed_until = (CURRENT_DATE + INTERVAL '30 days')::date,
          updated_at = now()
      WHERE entity_type = 'deal'
        AND entity_id = NEW.id
        AND status IN ('open', 'in_progress');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE OR REPLACE FUNCTION rm_tasks_wake_snoozed()
RETURNS integer AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE rm_tasks
  SET status = 'open', snoozed_until = NULL, updated_at = now()
  WHERE status = 'snoozed'
    AND snoozed_until IS NOT NULL
    AND snoozed_until <= CURRENT_DATE;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE OR REPLACE FUNCTION rm_tasks_expire_ai_suggestions()
RETURNS integer AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE rm_tasks
  SET dismissed_at = now(), updated_at = now()
  WHERE source = 'ai'
    AND confirmed_at IS NULL
    AND dismissed_at IS NULL
    AND expires_at IS NOT NULL
    AND expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 4. Add explicit WITH CHECK to admin policies for clarity
-- Drop and recreate with explicit WITH CHECK

DROP POLICY IF EXISTS "admin_all_rm_tasks" ON rm_tasks;
CREATE POLICY "admin_all_rm_tasks"
  ON rm_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "admin_all_rm_deal_team" ON rm_deal_team;
CREATE POLICY "admin_all_rm_deal_team"
  ON rm_deal_team FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "service_role_rm_tasks" ON rm_tasks;
CREATE POLICY "service_role_rm_tasks"
  ON rm_tasks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_rm_deal_team" ON rm_deal_team;
CREATE POLICY "service_role_rm_deal_team"
  ON rm_deal_team FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Entity name resolution function
-- Resolves the display name for any entity_type + entity_id pair
CREATE OR REPLACE FUNCTION resolve_rm_entity_name(p_entity_type text, p_entity_id uuid)
RETURNS text AS $$
BEGIN
  IF p_entity_type = 'deal' THEN
    RETURN (SELECT title FROM listings WHERE id = p_entity_id);
  ELSIF p_entity_type = 'buyer' THEN
    RETURN (SELECT company_name FROM remarketing_buyers WHERE id = p_entity_id);
  ELSIF p_entity_type = 'contact' THEN
    RETURN (
      SELECT COALESCE(
        NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
        email
      )
      FROM contacts WHERE id = p_entity_id
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public';

-- 6. Enriched tasks view with entity names resolved
CREATE OR REPLACE VIEW rm_tasks_enriched AS
SELECT
  t.*,
  resolve_rm_entity_name(t.entity_type, t.entity_id) AS entity_name,
  resolve_rm_entity_name(t.secondary_entity_type, t.secondary_entity_id) AS secondary_entity_name
FROM rm_tasks t;

-- Grant access to the view
GRANT SELECT ON rm_tasks_enriched TO authenticated;
GRANT SELECT ON rm_tasks_enriched TO service_role;

-- 7. Atomic template creation RPC function
-- Creates all tasks from a template in a single transaction
CREATE OR REPLACE FUNCTION rm_create_template_tasks(
  p_template_tasks jsonb,
  p_deal_id uuid,
  p_owner_id uuid,
  p_created_by uuid
)
RETURNS uuid[] AS $$
DECLARE
  task_rec jsonb;
  created_ids uuid[] := '{}';
  new_id uuid;
  depends_idx integer;
BEGIN
  FOR task_rec IN SELECT * FROM jsonb_array_elements(p_template_tasks)
  LOOP
    depends_idx := (task_rec ->> 'depends_on_index')::integer;

    INSERT INTO rm_tasks (
      title, entity_type, entity_id, due_date, priority,
      owner_id, source, depends_on, created_by
    ) VALUES (
      task_rec ->> 'title',
      'deal',
      p_deal_id,
      (CURRENT_DATE + ((task_rec ->> 'due_days')::integer || ' days')::interval)::date,
      task_rec ->> 'priority',
      p_owner_id,
      'template',
      CASE WHEN depends_idx IS NOT NULL THEN created_ids[depends_idx + 1] ELSE NULL END,
      p_created_by
    )
    RETURNING id INTO new_id;

    created_ids := array_append(created_ids, new_id);
  END LOOP;

  RETURN created_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION rm_create_template_tasks(jsonb, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rm_create_template_tasks(jsonb, uuid, uuid, uuid) TO service_role;
