-- Create function to update journey milestones with automatic stage progression
CREATE OR REPLACE FUNCTION public.update_journey_milestone(
  p_visitor_id TEXT,
  p_milestone_key TEXT,
  p_milestone_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS VOID AS $$
BEGIN
  UPDATE public.user_journeys
  SET 
    milestones = jsonb_set(
      COALESCE(milestones, '{}'::jsonb),
      ARRAY[p_milestone_key],
      to_jsonb(p_milestone_time::text)
    ),
    journey_stage = CASE 
      WHEN p_milestone_key = 'first_connection_at' THEN 'converted'
      WHEN p_milestone_key IN ('nda_signed_at', 'fee_agreement_at') THEN 'qualified'
      WHEN p_milestone_key = 'signup_at' THEN 'registered'
      ELSE journey_stage
    END,
    updated_at = NOW()
  WHERE visitor_id = p_visitor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated users and anon
GRANT EXECUTE ON FUNCTION public.update_journey_milestone(TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_journey_milestone(TEXT, TEXT, TIMESTAMPTZ) TO anon;

-- Create function to link journey to user on authentication
CREATE OR REPLACE FUNCTION public.link_journey_to_user(
  p_visitor_id TEXT,
  p_user_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE public.user_journeys
  SET 
    user_id = p_user_id,
    journey_stage = CASE 
      WHEN journey_stage = 'anonymous' THEN 'registered'
      ELSE journey_stage
    END,
    milestones = jsonb_set(
      COALESCE(milestones, '{}'::jsonb),
      ARRAY['signup_at'],
      to_jsonb(NOW()::text)
    ),
    updated_at = NOW()
  WHERE visitor_id = p_visitor_id AND user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.link_journey_to_user(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_journey_to_user(TEXT, UUID) TO anon;