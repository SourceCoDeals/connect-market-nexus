-- Enhanced connection request merging and conflict resolution

-- First, create a function to handle enhanced duplicate detection with message updates
CREATE OR REPLACE FUNCTION public.enhanced_merge_or_create_connection_request(
  p_listing_id UUID,
  p_user_message TEXT,
  p_lead_name TEXT DEFAULT NULL,
  p_lead_email TEXT DEFAULT NULL,
  p_lead_company TEXT DEFAULT NULL,
  p_lead_role TEXT DEFAULT NULL,
  p_lead_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_user_profile record;
  v_existing_request record;
  v_existing_lead_request record;
  v_new_request_id uuid;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN 
    RAISE EXCEPTION 'User not authenticated'; 
  END IF;

  -- Get user profile
  SELECT * INTO v_user_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'User profile not found'; 
  END IF;

  -- Check for existing marketplace request from this user for this listing
  SELECT * INTO v_existing_request
  FROM public.connection_requests
  WHERE user_id = v_user_id 
    AND listing_id = p_listing_id 
    AND status != 'rejected'
  ORDER BY created_at DESC
  LIMIT 1;

  -- If user already has a request for this listing, update with new message and conflict info
  IF v_existing_request.id IS NOT NULL THEN
    -- Update the existing request with the new message and mark as duplicate submission
    UPDATE public.connection_requests
    SET 
      user_message = p_user_message,
      source_metadata = COALESCE(source_metadata, '{}'::jsonb) || 
        jsonb_build_object(
          'has_duplicate_submission', true,
          'duplicate_submission_count', COALESCE((source_metadata->'duplicate_submission_count')::int, 0) + 1,
          'previous_message', v_existing_request.user_message,
          'latest_message_at', NOW(),
          'needs_admin_review', true,
          'duplicate_reason', 'same_user_same_listing'
        ),
      updated_at = NOW()
    WHERE id = v_existing_request.id;

    -- Return existing request info with conflict details
    RETURN jsonb_build_object(
      'request_id', v_existing_request.id,
      'is_duplicate', true,
      'duplicate_type', 'same_user_same_listing',
      'action_taken', 'updated_existing_request',
      'previous_message', v_existing_request.user_message,
      'new_message', p_user_message
    );
  END IF;

  -- Check for existing lead request with same email for this listing
  SELECT * INTO v_existing_lead_request
  FROM public.connection_requests
  WHERE user_id IS NULL 
    AND lead_email = v_user_profile.email 
    AND listing_id = p_listing_id 
    AND status != 'rejected'
  ORDER BY created_at DESC
  LIMIT 1;

  -- If there's a lead request, merge it with user profile
  IF v_existing_lead_request.id IS NOT NULL THEN
    UPDATE public.connection_requests
    SET 
      user_id = v_user_id,
      user_message = p_user_message,
      source = 'marketplace',
      source_metadata = COALESCE(source_metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'is_channel_duplicate', true,
          'channel_merge', 'website_to_marketplace',
          'merged_at', NOW(),
          'original_lead_email', v_existing_lead_request.lead_email,
          'original_message', v_existing_lead_request.user_message,
          'marketplace_message', p_user_message,
          'needs_admin_review', true
        ),
      updated_at = NOW()
    WHERE id = v_existing_lead_request.id;

    RETURN jsonb_build_object(
      'request_id', v_existing_lead_request.id,
      'is_duplicate', true,
      'duplicate_type', 'channel_merge',
      'action_taken', 'merged_lead_to_user',
      'original_lead_message', v_existing_lead_request.user_message,
      'new_marketplace_message', p_user_message
    );
  END IF;

  -- Create new request if no duplicates found
  INSERT INTO public.connection_requests (
    user_id, listing_id, user_message,
    lead_name, lead_email, lead_company, lead_role, lead_phone,
    source, status, source_metadata
  ) VALUES (
    v_user_id,
    p_listing_id,
    p_user_message,
    COALESCE(p_lead_name, v_user_profile.first_name || ' ' || v_user_profile.last_name),
    COALESCE(p_lead_email, v_user_profile.email),
    COALESCE(p_lead_company, v_user_profile.company),
    COALESCE(p_lead_role, v_user_profile.job_title),
    p_lead_phone,
    'marketplace',
    'pending',
    jsonb_build_object('original_channel', 'marketplace')
  ) RETURNING id INTO v_new_request_id;

  RETURN jsonb_build_object(
    'request_id', v_new_request_id,
    'is_duplicate', false,
    'action_taken', 'created_new_request'
  );
END;
$$;

-- Create a helper function to detect cross-channel conflicts for admin use
CREATE OR REPLACE FUNCTION public.get_connection_request_conflicts()
RETURNS TABLE(
  request_id uuid,
  user_email text,
  listing_title text,
  conflict_type text,
  conflict_details jsonb,
  needs_review boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    cr.id as request_id,
    COALESCE(p.email, cr.lead_email) as user_email,
    l.title as listing_title,
    CASE 
      WHEN cr.source_metadata->>'has_duplicate_submission' = 'true' THEN 'duplicate_submission'
      WHEN cr.source_metadata->>'is_channel_duplicate' = 'true' THEN 'channel_merge'
      ELSE 'unknown'
    END as conflict_type,
    cr.source_metadata as conflict_details,
    COALESCE((cr.source_metadata->>'needs_admin_review')::boolean, false) as needs_review
  FROM connection_requests cr
  LEFT JOIN profiles p ON cr.user_id = p.id
  LEFT JOIN listings l ON cr.listing_id = l.id
  WHERE (
    cr.source_metadata->>'has_duplicate_submission' = 'true' OR
    cr.source_metadata->>'is_channel_duplicate' = 'true'
  )
  AND cr.status != 'rejected'
  ORDER BY cr.updated_at DESC
$$;