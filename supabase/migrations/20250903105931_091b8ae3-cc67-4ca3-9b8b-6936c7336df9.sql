-- Add realistic tasks for each deal to provide meaningful task counts
INSERT INTO deal_tasks (deal_id, title, description, priority, status, assigned_to, due_date, created_at)
SELECT 
  d.id as deal_id,
  task_title,
  task_description,
  task_priority,
  task_status,
  d.assigned_to,
  d.created_at + (task_data.days_offset || ' days')::interval as due_date,
  d.created_at + (task_data.created_offset || ' days')::interval as created_at
FROM deals d
CROSS JOIN (
  VALUES 
    -- Early stage tasks (Lead qualification, Initial outreach)
    ('Initial Qualification Call', 'Schedule and conduct buyer qualification call', 'high', 'completed', 1, 0),
    ('Collect Buyer Profile', 'Gather detailed buyer information and preferences', 'medium', 'completed', 2, 1),
    ('Send NDA', 'Prepare and send Non-Disclosure Agreement', 'high', 'pending', 3, 2),
    
    -- Mid-stage tasks (Due diligence, Documentation)
    ('Schedule Management Meeting', 'Arrange introductory call with management team', 'medium', 'pending', 7, 3),
    ('Prepare Information Package', 'Compile comprehensive deal information', 'medium', 'in_progress', 5, 2),
    ('Financial Review', 'Review and validate financial statements', 'high', 'pending', 10, 4),
    ('Send Fee Agreement', 'Prepare and send broker fee agreement', 'high', 'pending', 4, 1),
    
    -- Later stage tasks (Negotiations, Closing)
    ('Draft LOI', 'Prepare Letter of Intent with terms', 'high', 'pending', 14, 5),
    ('Coordinate Site Visit', 'Arrange buyer visit to business location', 'medium', 'pending', 12, 6),
    ('Legal Documentation', 'Coordinate legal document preparation', 'high', 'pending', 21, 10),
    ('Closing Coordination', 'Manage final closing process', 'urgent', 'pending', 30, 15)
) AS task_data(task_title, task_description, task_priority, task_status, days_offset, created_offset)
WHERE d.id IS NOT NULL
-- Add tasks based on stage progression and deal age
AND (
  -- Early stage deals get early tasks
  (d.stage_id IN (SELECT id FROM deal_stages WHERE position <= 2) AND task_data.days_offset <= 7) OR
  -- Mid stage deals get mid-level tasks
  (d.stage_id IN (SELECT id FROM deal_stages WHERE position BETWEEN 3 AND 4) AND task_data.days_offset <= 14) OR
  -- Late stage deals get all tasks
  (d.stage_id IN (SELECT id FROM deal_stages WHERE position >= 5))
)
-- Only add tasks if the deal has been around long enough
AND d.created_at <= (NOW() - (task_data.created_offset || ' days')::interval)
-- Randomly assign some tasks as completed (70% completion rate for older tasks)
AND (
  task_data.task_status = 'completed' OR 
  (task_data.task_status = 'pending' AND random() > 0.3) OR
  (task_data.task_status = 'in_progress' AND random() > 0.5)
);

-- Update task status based on realistic progression
UPDATE deal_tasks 
SET status = CASE 
  WHEN created_at < (NOW() - INTERVAL '7 days') AND random() > 0.2 THEN 'completed'
  WHEN created_at < (NOW() - INTERVAL '3 days') AND random() > 0.4 THEN 'in_progress'
  ELSE status
END
WHERE status = 'pending';

-- Add some deal activities to show engagement
INSERT INTO deal_activities (deal_id, admin_id, activity_type, title, description, created_at)
SELECT 
  d.id as deal_id,
  d.assigned_to as admin_id,
  activity_type,
  activity_title,
  activity_description,
  d.created_at + (activity_data.days_offset || ' days')::interval as created_at
FROM deals d
CROSS JOIN (
  VALUES 
    ('call', 'Initial Buyer Call', 'Conducted qualification call with potential buyer', 1),
    ('email', 'Sent Deal Summary', 'Emailed executive summary and key deal points', 2),
    ('meeting', 'Management Introduction', 'Facilitated intro meeting between buyer and seller', 5),
    ('document', 'Shared Financial Package', 'Provided detailed financial information', 7),
    ('call', 'Follow-up Discussion', 'Discussed buyer feedback and next steps', 10),
    ('email', 'Status Update', 'Updated all parties on transaction progress', 14)
) AS activity_data(activity_type, activity_title, activity_description, days_offset)
WHERE d.id IS NOT NULL
AND d.created_at <= (NOW() - (activity_data.days_offset || ' days')::interval)
-- Add activities based on stage progression (more activities for advanced deals)
AND (
  (d.stage_id IN (SELECT id FROM deal_stages WHERE position <= 2) AND activity_data.days_offset <= 7) OR
  (d.stage_id IN (SELECT id FROM deal_stages WHERE position >= 3) AND activity_data.days_offset <= 14)
);