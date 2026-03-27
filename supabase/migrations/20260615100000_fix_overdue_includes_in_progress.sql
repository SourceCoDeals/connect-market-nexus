-- Fix mark_overdue_standup_tasks() to include 'in_progress' status.
--
-- The RPC function (used as client-side fallback when pg_cron is unavailable)
-- was only checking status = 'pending', missing 'in_progress'. This meant
-- tasks marked "in progress" that went past due were never flagged overdue
-- unless pg_cron was running the inline SQL version (which correctly checks
-- both statuses).

CREATE OR REPLACE FUNCTION public.mark_overdue_standup_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.daily_standup_tasks
  SET status = 'overdue',
      updated_at = now()
  WHERE status IN ('pending', 'in_progress')
    AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
