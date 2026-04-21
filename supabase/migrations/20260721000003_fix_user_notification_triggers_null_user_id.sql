-- Fix connection request triggers to handle NULL user_id (lead-only requests).
--
-- Connection requests created from public landing pages (lead submissions)
-- have a NULL user_id because the submitter is not an authenticated user.
-- Several trigger functions on connection_requests unconditionally insert
-- into downstream tables using NEW.user_id, which fails NOT NULL constraints
-- and causes admin Accept / Decline / On Hold actions to error out. Example:
--
--   null value in column "user_id" of relation "user_notifications"
--   violates not-null constraint
--
-- This migration guards every affected trigger so they silently skip the
-- downstream insert when the underlying connection request has no associated
-- authenticated user:
--
--   1. notify_user_on_connection_request       (INSERT trigger)
--   2. notify_user_on_status_change            (UPDATE trigger on status)
--   3. notify_user_on_admin_comment            (UPDATE trigger on admin_comment)
--   4. notify_user_on_stage_change             (UPDATE trigger on pipeline_stage_id)
--   5. create_listing_conversation             (UPDATE trigger on status='approved')
--
-- The listing_conversations.user_id column is NOT NULL REFERENCES profiles(id)
-- (see 20251119161857_*.sql), so without this guard lead-based approvals would
-- trip that constraint immediately after we unblock the user_notifications
-- triggers above.

-- Trigger function: New connection request
CREATE OR REPLACE FUNCTION public.notify_user_on_connection_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function: Status changed
CREATE OR REPLACE FUNCTION public.notify_user_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.user_id IS NOT NULL THEN
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

-- Trigger function: Admin comment added
CREATE OR REPLACE FUNCTION public.notify_user_on_admin_comment()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.admin_comment IS DISTINCT FROM NEW.admin_comment)
     AND (NEW.admin_comment IS NOT NULL AND NEW.admin_comment != '')
     AND NEW.user_id IS NOT NULL THEN
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

-- Trigger function: Pipeline stage changed
CREATE OR REPLACE FUNCTION public.notify_user_on_stage_change()
RETURNS TRIGGER AS $$
DECLARE
  stage_name TEXT;
BEGIN
  IF OLD.pipeline_stage_id IS DISTINCT FROM NEW.pipeline_stage_id
     AND NEW.user_id IS NOT NULL THEN
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

-- Trigger function: Auto-create listing_conversations on approval
-- Original defined in 20251119161857_*.sql. listing_conversations.user_id is
-- NOT NULL REFERENCES profiles(id), so inserting NEW.user_id for a lead-only
-- request (user_id IS NULL) fails with a not-null constraint violation and
-- blocks the entire approval. Skip conversation creation for lead-only
-- requests — there is no authenticated buyer account to create a
-- conversation for yet; one can be created later if/when the lead signs up.
CREATE OR REPLACE FUNCTION public.create_listing_conversation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved'
     AND OLD.status != 'approved'
     AND NEW.user_id IS NOT NULL THEN
    INSERT INTO listing_conversations (
      listing_id,
      connection_request_id,
      user_id,
      admin_id
    )
    VALUES (
      NEW.listing_id,
      NEW.id,
      NEW.user_id,
      NEW.approved_by
    )
    ON CONFLICT (connection_request_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
