-- Create app_settings table for platform-wide configuration
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed default: auto-approve high-confidence standup tasks
INSERT INTO app_settings (key, value)
VALUES ('task_auto_approve_high_confidence', 'true')
ON CONFLICT (key) DO NOTHING;

-- Allow authenticated users to read settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read app_settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/owners can update settings (via service role or RLS)
CREATE POLICY "Admins can update app_settings"
  ON app_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('owner', 'admin')
    )
  );
