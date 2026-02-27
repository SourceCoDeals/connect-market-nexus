-- ============================================================
-- AI Task Management System — v3.0 Audit #2 Fixes
-- Fixes: security_invoker on enriched view, RPC auth validation,
--        updated_at trigger search_path
-- ============================================================

-- 1. Enable security_invoker on the enriched view
-- Without this, the view runs as its owner (postgres) and bypasses RLS.
-- With security_invoker = true, queries execute using the calling user's
-- permissions, so RLS policies on rm_tasks are properly enforced.
ALTER VIEW rm_tasks_enriched SET (security_invoker = true);

-- 2. Harden rm_create_template_tasks to validate p_created_by matches caller
-- Prevents a malicious user from attributing task creation to another user.
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
  -- Validate that the caller is creating tasks on their own behalf
  IF p_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'created_by must match the authenticated user';
  END IF;

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

-- 3. Harden update_rm_tasks_updated_at trigger with search_path
-- For consistency with all other SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION update_rm_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';
