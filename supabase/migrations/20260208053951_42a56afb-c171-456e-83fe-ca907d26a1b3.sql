-- Cleanup contaminated Rewind Restoration data
-- service_regions was populated from PE firm (LP First Capital) HQ in TX — must be NULL
-- target_services was never populated due to mapping bug (was going to target_industries instead)
UPDATE remarketing_buyers SET 
  service_regions = NULL,
  target_services = target_industries,
  data_last_updated = now()
WHERE id = 'd6d93eda-0941-45cb-829b-383259cca26f';

-- Reset the 3 pending transcripts so they can be re-extracted
UPDATE buyer_transcripts SET
  extraction_status = 'pending',
  extraction_error = NULL
WHERE buyer_id = 'd6d93eda-0941-45cb-829b-383259cca26f'
  AND extraction_status = 'pending';