-- Fix notify_mentioned_admins to match admin_notifications schema and add trigger on deal_comments
-- 1) Create or replace the function with correct column names
CREATE OR REPLACE FUNCTION public.notify_mentioned_admins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mentioned_admin_id UUID;
  commenter_name TEXT;
  deal_title TEXT;
BEGIN
  -- Resolve commenter display name (fallback to email)
  SELECT COALESCE(NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), ''), email)
  INTO commenter_name
  FROM public.profiles
  WHERE id = NEW.admin_id;

  -- Resolve deal title (fallback empty)
  SELECT title INTO deal_title
  FROM public.deals
  WHERE id = NEW.deal_id;

  -- Create notification for each mentioned admin
  IF NEW.mentioned_admins IS NOT NULL AND array_length(NEW.mentioned_admins, 1) > 0 THEN
    FOREACH mentioned_admin_id IN ARRAY NEW.mentioned_admins LOOP
      -- Skip self-mentions
      IF mentioned_admin_id != NEW.admin_id THEN
        INSERT INTO public.admin_notifications (
          admin_id,
          notification_type,
          title,
          message,
          action_url,
          metadata,
          deal_id,
          user_id
        ) VALUES (
          mentioned_admin_id,
          'mention',
          commenter_name || ' mentioned you',
          'In a comment on "' || COALESCE(deal_title, '') || '"',
          '/admin/pipeline?deal=' || NEW.deal_id::text || '&tab=overview',
          jsonb_build_object(
            'comment_id', NEW.id,
            'deal_id', NEW.deal_id,
            'commenter_id', NEW.admin_id,
            'commenter_name', commenter_name
          ),
          NEW.deal_id,
          NEW.admin_id
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Create trigger to call the function on insert (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname = 'notify_mentioned_admins_trigger'
      AND c.relname = 'deal_comments'
      AND n.nspname = 'public'
  ) THEN
    CREATE TRIGGER notify_mentioned_admins_trigger
    AFTER INSERT ON public.deal_comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_mentioned_admins();
  END IF;
END $$;

-- 3) Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin_id_created_at
  ON public.admin_notifications (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read
  ON public.admin_notifications (is_read);
