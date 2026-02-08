-- Clean Rewind Restoration's contaminated data so re-extraction starts fresh
UPDATE public.remarketing_buyers SET 
  business_summary = NULL,
  services_offered = NULL,
  operating_locations = NULL,
  geographic_footprint = NULL,
  service_regions = NULL,
  thesis_summary = NULL,
  thesis_confidence = NULL,
  strategic_priorities = NULL,
  target_industries = NULL
WHERE id = 'd6d93eda-0941-45cb-829b-383259cca26f';

-- Also reset the buyer_transcripts extraction status so they get re-processed
UPDATE public.buyer_transcripts SET 
  extraction_status = 'pending',
  extracted_insights = NULL,
  processed_at = NULL
WHERE buyer_id = 'd6d93eda-0941-45cb-829b-383259cca26f';