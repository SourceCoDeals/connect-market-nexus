-- G10 FIX: Alert other deal owners when a deal on the same listing reaches
-- LOI or closes. On a buy-side intro platform, when Blackstone signs an LOI
-- with exclusivity, the advisor managing the Apex deal on the same listing
-- needs to know immediately.

CREATE OR REPLACE FUNCTION public.notify_listing_peers_on_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stage_name TEXT;
  new_stage_type TEXT;
  v_listing_id UUID;
  v_deal_title TEXT;
  v_peer RECORD;
BEGIN
  -- Only fire on stage_id change
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT name, stage_type INTO new_stage_name, new_stage_type
    FROM public.deal_stages WHERE id = NEW.stage_id;

  -- Only notify on milestone stages
  IF new_stage_name NOT IN ('LOI Submitted', 'Under Contract')
     AND new_stage_type NOT IN ('closed_won', 'closed_lost') THEN
    RETURN NEW;
  END IF;

  v_listing_id := NEW.listing_id;
  v_deal_title := NEW.title;

  IF v_listing_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find all OTHER deals on this listing with different owners
  FOR v_peer IN
    SELECT DISTINCT dp.assigned_to, dp.title AS peer_title
    FROM public.deal_pipeline dp
    WHERE dp.listing_id = v_listing_id
      AND dp.id <> NEW.id
      AND dp.assigned_to IS NOT NULL
      AND dp.assigned_to <> COALESCE(NEW.assigned_to, '00000000-0000-0000-0000-000000000000')
      AND dp.deleted_at IS NULL
  LOOP
    INSERT INTO public.user_notifications (
      user_id, notification_type, title, message, metadata
    ) VALUES (
      v_peer.assigned_to,
      'deal_milestone',
      format('Deal milestone on shared listing: %s', new_stage_name),
      format('"%s" moved to %s. You also have a deal on this listing ("%s").',
        v_deal_title, new_stage_name, v_peer.peer_title),
      jsonb_build_object(
        'deal_id', NEW.id,
        'listing_id', v_listing_id,
        'stage_name', new_stage_name,
        'stage_type', new_stage_type,
        'peer_deal_title', v_peer.peer_title
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_listing_peers ON public.deal_pipeline;
CREATE TRIGGER trg_notify_listing_peers
  AFTER UPDATE OF stage_id ON public.deal_pipeline
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_listing_peers_on_milestone();

COMMENT ON FUNCTION public.notify_listing_peers_on_milestone() IS
  'G10: Notifies owners of other deals on the same listing when a deal hits '
  'LOI Submitted, Under Contract, Closed Won, or Closed Lost.';
