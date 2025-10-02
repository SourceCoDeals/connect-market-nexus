-- Add deleted_at column to deals table for soft delete
ALTER TABLE public.deals 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.deals.deleted_at IS 'Soft delete timestamp - when deal was deleted';

-- Add stage_type to deal_stages to identify closed/won/lost stages
ALTER TABLE public.deal_stages 
ADD COLUMN stage_type text DEFAULT 'active' CHECK (stage_type IN ('active', 'closed_won', 'closed_lost'));

COMMENT ON COLUMN public.deal_stages.stage_type IS 'Stage type: active (normal pipeline), closed_won (successful), closed_lost (unsuccessful)';

-- Update any existing "won" or "closed" stages
UPDATE public.deal_stages 
SET stage_type = CASE 
  WHEN LOWER(name) LIKE '%won%' OR LOWER(name) LIKE '%success%' THEN 'closed_won'
  WHEN LOWER(name) LIKE '%lost%' OR LOWER(name) LIKE '%reject%' OR LOWER(name) LIKE '%declined%' THEN 'closed_lost'
  ELSE 'active'
END
WHERE stage_type = 'active';

-- Create soft delete function for deals
CREATE OR REPLACE FUNCTION public.soft_delete_deal(deal_id uuid, deletion_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if the calling user is an admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can delete deals';
  END IF;
  
  -- Soft delete the deal by setting deleted_at timestamp
  UPDATE public.deals 
  SET 
    deleted_at = NOW(),
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'deleted_by', auth.uid(),
      'deletion_reason', deletion_reason,
      'deleted_at_iso', NOW()::text
    )
  WHERE id = deal_id AND deleted_at IS NULL;
  
  -- Log the deletion activity
  IF FOUND THEN
    INSERT INTO public.deal_activities (
      deal_id,
      admin_id,
      activity_type,
      title,
      description,
      metadata
    ) VALUES (
      deal_id,
      auth.uid(),
      'deal_deleted',
      'Deal Deleted',
      COALESCE('Reason: ' || deletion_reason, 'Deal was deleted'),
      jsonb_build_object('deletion_reason', deletion_reason)
    );
  END IF;
  
  RETURN FOUND;
END;
$$;

-- Create restore deal function
CREATE OR REPLACE FUNCTION public.restore_deal(deal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if the calling user is an admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can restore deals';
  END IF;
  
  -- Restore the deal by clearing deleted_at timestamp
  UPDATE public.deals 
  SET 
    deleted_at = NULL,
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'restored_by', auth.uid(),
      'restored_at', NOW()::text
    )
  WHERE id = deal_id AND deleted_at IS NOT NULL;
  
  -- Log the restoration activity
  IF FOUND THEN
    INSERT INTO public.deal_activities (
      deal_id,
      admin_id,
      activity_type,
      title,
      description
    ) VALUES (
      deal_id,
      auth.uid(),
      'deal_restored',
      'Deal Restored',
      'Deal was restored from deleted status'
    );
  END IF;
  
  RETURN FOUND;
END;
$$;

-- Insert "Closed Lost" stage if it doesn't exist
INSERT INTO public.deal_stages (name, description, position, color, stage_type, default_probability, is_active, is_default)
SELECT 
  'Closed Lost',
  'Deals that were lost or rejected',
  (SELECT COALESCE(MAX(position), 0) + 1 FROM public.deal_stages),
  '#ef4444',
  'closed_lost',
  0,
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.deal_stages WHERE stage_type = 'closed_lost'
);

-- Insert "Closed Won" stage if it doesn't exist
INSERT INTO public.deal_stages (name, description, position, color, stage_type, default_probability, is_active, is_default)
SELECT 
  'Closed Won',
  'Successfully completed deals',
  (SELECT COALESCE(MAX(position), 0) + 1 FROM public.deal_stages),
  '#22c55e',
  'closed_won',
  100,
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.deal_stages WHERE stage_type = 'closed_won'
);

COMMENT ON FUNCTION public.soft_delete_deal IS 'Soft delete a deal (admin only) with optional reason';
COMMENT ON FUNCTION public.restore_deal IS 'Restore a soft-deleted deal (admin only)';