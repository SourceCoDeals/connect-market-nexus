-- pg_cron mark-overdue-tasks (fix dollar-quoting)
DO $outer$
BEGIN
  PERFORM cron.schedule('mark-overdue-tasks', '55 5 * * *',
    'UPDATE public.daily_standup_tasks SET status = ''overdue'', updated_at = now() WHERE status IN (''pending'',''in_progress'') AND due_date < CURRENT_DATE');
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'pg_cron not available — skipping mark-overdue-tasks';
END $outer$;