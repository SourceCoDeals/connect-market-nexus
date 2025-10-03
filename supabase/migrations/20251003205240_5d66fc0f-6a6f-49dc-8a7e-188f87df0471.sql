-- =====================================================
-- ADMIN NOTIFICATION SYSTEM - COMPREHENSIVE ENHANCEMENT
-- =====================================================

-- Step 1: Enhance admin_notifications table with new columns
ALTER TABLE public.admin_notifications
  -- Make feedback_id nullable (not all notifications relate to feedback)
  ALTER COLUMN feedback_id DROP NOT NULL,
  
  -- Add flexible reference fields
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.deal_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Add metadata for flexible data storage
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Add action URL for navigation
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  
  -- Add read timestamp (is_read already exists)
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Add new notification type column
ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS notification_type TEXT NOT NULL DEFAULT 'response_sent';

-- Step 3: Update existing rows to have proper notification_type
UPDATE public.admin_notifications 
SET notification_type = 'response_sent'
WHERE notification_type IS NULL OR notification_type = '';

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_notifications_deal_id ON public.admin_notifications(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_task_id ON public.admin_notifications(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON public.admin_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON public.admin_notifications(admin_id, is_read, created_at DESC) WHERE is_read = false;

-- Step 5: Add comment for documentation
COMMENT ON TABLE public.admin_notifications IS 'Stores all admin notifications including task assignments, deal updates, and feedback responses';
COMMENT ON COLUMN public.admin_notifications.notification_type IS 'Types: task_assigned, task_completed, deal_stage_changed, response_sent, connection_request_new, deal_follow_up_needed';
COMMENT ON COLUMN public.admin_notifications.metadata IS 'Flexible JSON storage for notification-specific data like priority, due_date, deal_title, etc.';
COMMENT ON COLUMN public.admin_notifications.action_url IS 'URL to navigate to when notification is clicked, e.g., /admin/pipeline?deal=uuid&tab=tasks';

-- Step 6: Create function to auto-cleanup old read notifications (90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_notifications
  WHERE is_read = true 
    AND read_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Step 7: Enable realtime for admin_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.admin_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO authenticated;