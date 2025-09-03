-- Add realistic tasks for each deal (simplified approach)
INSERT INTO deal_tasks (deal_id, title, description, priority, status, assigned_to, due_date)
SELECT 
  d.id as deal_id,
  CASE stage_pos.position
    WHEN 1 THEN 'Initial Qualification Call'
    WHEN 2 THEN 'Send NDA'
    WHEN 3 THEN 'Prepare Information Package'
    WHEN 4 THEN 'Schedule Management Meeting'
    WHEN 5 THEN 'Financial Review'
    ELSE 'Follow-up Tasks'
  END as title,
  CASE stage_pos.position
    WHEN 1 THEN 'Conduct buyer qualification and interest assessment'
    WHEN 2 THEN 'Prepare and send Non-Disclosure Agreement'
    WHEN 3 THEN 'Compile comprehensive deal information package'
    WHEN 4 THEN 'Arrange introductory call with management team'
    WHEN 5 THEN 'Review and validate financial statements'
    ELSE 'Complete remaining deal activities'
  END as description,
  CASE stage_pos.position
    WHEN 1 THEN 'high'
    WHEN 2 THEN 'high'
    WHEN 3 THEN 'medium'
    WHEN 4 THEN 'medium'
    WHEN 5 THEN 'high'
    ELSE 'medium'
  END as priority,
  CASE 
    WHEN stage_pos.position <= 2 THEN 'completed'
    WHEN stage_pos.position <= 4 AND random() > 0.4 THEN 'completed'
    WHEN random() > 0.6 THEN 'in_progress'
    ELSE 'pending'
  END as status,
  d.assigned_to,
  (d.created_at + INTERVAL '7 days') as due_date
FROM deals d
CROSS JOIN (
  SELECT DISTINCT position 
  FROM deal_stages 
  WHERE position <= (SELECT position FROM deal_stages WHERE id = d.stage_id)
) stage_pos
WHERE d.id IS NOT NULL
LIMIT 500; -- Limit to avoid too many tasks

-- Add simple deal activities with valid activity types
INSERT INTO deal_activities (deal_id, admin_id, activity_type, title, description)
SELECT 
  d.id as deal_id,
  d.assigned_to as admin_id,
  'deal_update' as activity_type,
  'Deal Progress Update' as title,
  'Updated deal status and next steps' as description
FROM deals d
WHERE d.id IS NOT NULL
AND random() > 0.5 -- Only add to about half the deals
LIMIT 100;