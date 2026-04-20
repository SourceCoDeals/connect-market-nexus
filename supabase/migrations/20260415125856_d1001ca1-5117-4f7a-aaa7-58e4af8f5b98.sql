-- Backfill UTM params from raw_payload pageUrl into top-level source_metadata fields
UPDATE connection_requests
SET source_metadata = source_metadata
  || jsonb_build_object(
    'utm_source', 
    (regexp_match(
      (source_metadata->'raw_payload'->'payload'->>'pageUrl'),
      'utm_source=([^&]+)'
    ))[1],
    'utm_medium',
    (regexp_match(
      (source_metadata->'raw_payload'->'payload'->>'pageUrl'),
      'utm_medium=([^&]+)'
    ))[1],
    'utm_campaign',
    (regexp_match(
      (source_metadata->'raw_payload'->'payload'->>'pageUrl'),
      'utm_campaign=([^&]+)'
    ))[1],
    'utm_content',
    (regexp_match(
      (source_metadata->'raw_payload'->'payload'->>'pageUrl'),
      'utm_content=([^&]+)'
    ))[1],
    'utm_term',
    (regexp_match(
      (source_metadata->'raw_payload'->'payload'->>'pageUrl'),
      'utm_term=([^&]+)'
    ))[1]
  )
WHERE source = 'webflow'
  AND source_metadata->'raw_payload'->'payload'->>'pageUrl' LIKE '%utm_%'
  AND source_metadata->>'utm_source' IS NULL;