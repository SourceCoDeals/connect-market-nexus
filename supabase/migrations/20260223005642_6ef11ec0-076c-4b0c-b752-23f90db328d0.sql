
-- Trigger function: notify buyers when a new document is uploaded to a deal's data room
CREATE OR REPLACE FUNCTION public.notify_buyers_on_document_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a notification for every marketplace user who has data_room access to this deal
  INSERT INTO public.user_notifications (user_id, notification_type, title, message, metadata)
  SELECT
    dra.marketplace_user_id,
    'document_uploaded',
    'New Document Available',
    'A new document "' || NEW.file_name || '" has been added to the data room.',
    jsonb_build_object(
      'deal_id', NEW.deal_id,
      'document_id', NEW.id,
      'folder_name', NEW.folder_name,
      'file_name', NEW.file_name
    )
  FROM data_room_access dra
  WHERE dra.deal_id = NEW.deal_id
    AND dra.can_view_data_room = true
    AND dra.marketplace_user_id IS NOT NULL
    AND dra.revoked_at IS NULL;

  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_notify_buyers_on_document_upload
  AFTER INSERT ON public.data_room_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_buyers_on_document_upload();
