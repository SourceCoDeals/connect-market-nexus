-- Re-attach the status change notification trigger to connection_requests
-- This was dropped at some point, causing buyers to stop receiving approval/rejection notifications
CREATE TRIGGER trg_notify_user_on_status_change
  AFTER UPDATE ON public.connection_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_user_on_status_change();