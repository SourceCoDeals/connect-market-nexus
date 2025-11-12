-- Clean up Standard Pipeline view to remove deleted stage references
UPDATE pipeline_views
SET stage_config = (
  SELECT jsonb_agg(stage ORDER BY (stage->>'position')::int)
  FROM jsonb_array_elements(stage_config) AS stage
  WHERE stage->>'stageId' NOT IN ('94635142-b554-4cbb-92f7-54f24ddd61c2', 'a08d0ca5-fd75-4c25-be41-96d09bf79ca0')
),
updated_at = now()
WHERE stage_config::text LIKE '%94635142-b554-4cbb-92f7-54f24ddd61c2%'
   OR stage_config::text LIKE '%a08d0ca5-fd75-4c25-be41-96d09bf79ca0%';