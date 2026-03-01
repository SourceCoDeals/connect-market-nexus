-- Add free-form tags column to daily_standup_tasks
ALTER TABLE daily_standup_tasks
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- GIN index for efficient array containment queries
CREATE INDEX IF NOT EXISTS idx_dst_tags
  ON daily_standup_tasks USING GIN (tags);
