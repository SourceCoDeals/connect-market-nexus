UPDATE connection_requests
SET source_metadata = jsonb_set(
  source_metadata,
  '{utm_source}',
  to_jsonb(replace(source_metadata->>'utm_source', '#request', ''))
)
WHERE source = 'webflow'
  AND source_metadata->>'utm_source' LIKE '%#%';