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
  -- Get commenter name (fallback to email)
  SELECT COALESCE(NULLIF(trim(CONCAT(first_name, ' ', last_name)), ''), email) INTO commenter_name
  FROM profiles
  WHERE id = NEW.admin_id;

  -- Get deal title
  SELECT title INTO deal_title
  FROM deals
  WHERE id = NEW.deal_id;

  -- Create notification for each mentioned admin
  IF NEW.mentioned_admins IS NOT NULL AND array_length(NEW.mentioned_admins, 1) > 0 THEN
    FOREACH mentioned_admin_id IN ARRAY NEW.mentioned_admins
    LOOP
      -- Don't notify the commenter
      IF mentioned_admin_id != NEW.admin_id THEN
        INSERT INTO admin_notifications (
          admin_id,
          type,
          title,
          message,
          link,
          metadata
        ) VALUES (
          mentioned_admin_id,
          'mention',
          commenter_name || ' mentioned you',
          'In a comment on "' || deal_title || '"',
          '/admin/pipeline?deal=' || NEW.deal_id::text || '&tab=overview',
          jsonb_build_object(
            'comment_id', NEW.id,
            'deal_id', NEW.deal_id,
            'commenter_id', NEW.admin_id,
            'commenter_name', commenter_name
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;