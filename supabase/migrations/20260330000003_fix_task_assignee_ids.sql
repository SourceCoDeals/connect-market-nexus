-- ============================================================
-- Fix task assignee_id values that may not match user_roles.user_id
--
-- The extract-standup-tasks edge function previously used r.profiles.id
-- from an ambiguous PostgREST join (user_roles → profiles via auth.users)
-- instead of the canonical r.user_id.  When PostgREST resolved the FK
-- through the `assigned_by` column instead of `user_id`, the wrong
-- profile ID was stored as assignee_id.
--
-- This migration reconciles any affected rows by matching the profile
-- name back to the correct user_roles.user_id.
-- ============================================================

UPDATE daily_standup_tasks dst
SET    assignee_id = correct.user_id
FROM (
  -- For each task, find the "correct" user_roles.user_id whose profile
  -- name matches the profile currently pointed to by assignee_id.
  SELECT dst2.id AS task_id,
         ur.user_id
  FROM   daily_standup_tasks dst2
  JOIN   profiles wrong_p ON wrong_p.id = dst2.assignee_id
  JOIN   profiles right_p
    ON   right_p.first_name = wrong_p.first_name
   AND   right_p.last_name  = wrong_p.last_name
  JOIN   user_roles ur
    ON   ur.user_id = right_p.id
   AND   ur.role IN ('owner', 'admin', 'moderator')
  WHERE  dst2.assignee_id IS NOT NULL
    AND  NOT EXISTS (
           SELECT 1 FROM user_roles ur2
           WHERE ur2.user_id = dst2.assignee_id
             AND ur2.role IN ('owner', 'admin', 'moderator')
         )
) correct
WHERE dst.id = correct.task_id;
