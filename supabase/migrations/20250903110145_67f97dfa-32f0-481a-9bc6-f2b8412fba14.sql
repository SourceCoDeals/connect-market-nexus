-- Insert canonical tasks per deal, idempotent
INSERT INTO deal_tasks (deal_id, title, description, priority, status, assigned_to, due_date, created_at)
SELECT d.id,
       'Send NDA',
       'Prepare and send Non-Disclosure Agreement',
       'high',
       CASE WHEN ds.position <= 2 THEN 'pending' ELSE 'completed' END,
       d.assigned_to,
       d.created_at + INTERVAL '7 days',
       d.created_at + INTERVAL '1 day'
FROM deals d
JOIN deal_stages ds ON ds.id = d.stage_id
WHERE NOT EXISTS (
  SELECT 1 FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.title = 'Send NDA'
);

INSERT INTO deal_tasks (deal_id, title, description, priority, status, assigned_to, due_date, created_at)
SELECT d.id,
       'Prepare Information Package',
       'Compile and share initial information package with buyer',
       'medium',
       CASE WHEN ds.position BETWEEN 2 AND 4 THEN 'in_progress' ELSE 'pending' END,
       d.assigned_to,
       d.created_at + INTERVAL '10 days',
       d.created_at + INTERVAL '2 days'
FROM deals d
JOIN deal_stages ds ON ds.id = d.stage_id
WHERE NOT EXISTS (
  SELECT 1 FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.title = 'Prepare Information Package'
);

INSERT INTO deal_tasks (deal_id, title, description, priority, status, assigned_to, due_date, created_at)
SELECT d.id,
       'Financial Review',
       'Review financial statements and key metrics',
       'high',
       CASE WHEN ds.position >= 3 THEN 'pending' ELSE 'pending' END,
       d.assigned_to,
       d.created_at + INTERVAL '14 days',
       d.created_at + INTERVAL '5 days'
FROM deals d
JOIN deal_stages ds ON ds.id = d.stage_id
WHERE NOT EXISTS (
  SELECT 1 FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.title = 'Financial Review'
);

-- Insert allowed activities per deal, idempotent
INSERT INTO deal_activities (deal_id, admin_id, activity_type, title, description, created_at)
SELECT d.id,
       d.assigned_to,
       'email_sent',
       'Sent Deal Summary',
       'Emailed executive summary and key deal points to buyer',
       d.created_at + INTERVAL '2 days'
FROM deals d
WHERE NOT EXISTS (
  SELECT 1 FROM deal_activities da WHERE da.deal_id = d.id AND da.activity_type = 'email_sent' AND da.title = 'Sent Deal Summary'
);

INSERT INTO deal_activities (deal_id, admin_id, activity_type, title, description, created_at)
SELECT d.id,
       d.assigned_to,
       'call_made',
       'Initial Buyer Call',
       'Conducted qualification call with potential buyer',
       d.created_at + INTERVAL '1 day'
FROM deals d
WHERE NOT EXISTS (
  SELECT 1 FROM deal_activities da WHERE da.deal_id = d.id AND da.activity_type = 'call_made' AND da.title = 'Initial Buyer Call'
);

INSERT INTO deal_activities (deal_id, admin_id, activity_type, title, description, created_at)
SELECT d.id,
       d.assigned_to,
       'meeting_scheduled',
       'Management Intro Scheduled',
       'Scheduled intro meeting with management team',
       d.created_at + INTERVAL '7 days'
FROM deals d
JOIN deal_stages ds ON ds.id = d.stage_id
WHERE ds.position >= 3
AND NOT EXISTS (
  SELECT 1 FROM deal_activities da WHERE da.deal_id = d.id AND da.activity_type = 'meeting_scheduled' AND da.title = 'Management Intro Scheduled'
);
