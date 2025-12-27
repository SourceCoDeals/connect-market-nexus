-- Add test data for referral/sourcing fields to verify admin display
UPDATE profiles 
SET 
  referral_source = 'linkedin',
  referral_source_detail = 'Saw a post about European deal flow',
  deal_sourcing_methods = ARRAY['brokers', 'direct_outreach', 'proprietary_network'],
  target_acquisition_volume = '3_5'
WHERE id = '870a80e5-2753-49dd-a604-e46604087e66';