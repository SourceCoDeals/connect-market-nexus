-- Create user_notifications table
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_request_id UUID REFERENCES public.connection_requests(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_notifications_connection ON public.user_notifications(connection_request_id);

-- Enable RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications"
  ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.user_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.user_notifications FOR INSERT
  WITH CHECK (true);

-- Trigger function: New connection request
CREATE OR REPLACE FUNCTION public.notify_user_on_connection_request()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_notifications (
    user_id, 
    connection_request_id, 
    notification_type, 
    title, 
    message,
    metadata
  )
  VALUES (
    NEW.user_id,
    NEW.id,
    'request_created',
    'Connection Request Submitted',
    'Your connection request has been submitted and is under review.',
    jsonb_build_object(
      'listing_id', NEW.listing_id,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_connection_request_insert
  AFTER INSERT ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_on_connection_request();

-- Trigger function: Status changed
CREATE OR REPLACE FUNCTION public.notify_user_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.user_notifications (
      user_id, 
      connection_request_id, 
      notification_type, 
      title, 
      message,
      metadata
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      'status_changed',
      CASE 
        WHEN NEW.status = 'approved' THEN 'Connection Request Approved'
        WHEN NEW.status = 'rejected' THEN 'Connection Request Declined'
        WHEN NEW.status = 'on_hold' THEN 'Connection Request On Hold'
        ELSE 'Connection Request Updated'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Great news! Your connection request has been approved.'
        WHEN NEW.status = 'rejected' THEN 'Your connection request was declined. Continue exploring other opportunities.'
        WHEN NEW.status = 'on_hold' THEN 'Your connection request is currently on hold pending review.'
        ELSE 'Your connection request status has been updated.'
      END,
      jsonb_build_object(
        'listing_id', NEW.listing_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_connection_request_status_update
  AFTER UPDATE ON public.connection_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_user_on_status_change();

-- Trigger function: Admin comment added
CREATE OR REPLACE FUNCTION public.notify_user_on_admin_comment()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.admin_comment IS DISTINCT FROM NEW.admin_comment) 
     AND (NEW.admin_comment IS NOT NULL AND NEW.admin_comment != '') THEN
    INSERT INTO public.user_notifications (
      user_id, 
      connection_request_id, 
      notification_type, 
      title, 
      message,
      metadata
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      'admin_message',
      'New Message from Admin',
      'You have a new message regarding your connection request.',
      jsonb_build_object(
        'listing_id', NEW.listing_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_connection_request_admin_comment
  AFTER UPDATE ON public.connection_requests
  FOR EACH ROW
  WHEN (OLD.admin_comment IS DISTINCT FROM NEW.admin_comment)
  EXECUTE FUNCTION public.notify_user_on_admin_comment();

-- Trigger function: Pipeline stage changed
CREATE OR REPLACE FUNCTION public.notify_user_on_stage_change()
RETURNS TRIGGER AS $$
DECLARE
  stage_name TEXT;
BEGIN
  IF OLD.pipeline_stage_id IS DISTINCT FROM NEW.pipeline_stage_id THEN
    SELECT name INTO stage_name 
    FROM public.connection_request_stages 
    WHERE id = NEW.pipeline_stage_id;
    
    INSERT INTO public.user_notifications (
      user_id, 
      connection_request_id, 
      notification_type, 
      title, 
      message,
      metadata
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      'stage_updated',
      'Deal Stage Updated',
      'Your deal has moved to: ' || COALESCE(stage_name, 'a new stage'),
      jsonb_build_object(
        'listing_id', NEW.listing_id,
        'stage_id', NEW.pipeline_stage_id,
        'stage_name', stage_name
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_connection_request_stage_update
  AFTER UPDATE ON public.connection_requests
  FOR EACH ROW
  WHEN (OLD.pipeline_stage_id IS DISTINCT FROM NEW.pipeline_stage_id)
  EXECUTE FUNCTION public.notify_user_on_stage_change();