
-- Clean up duplicate agreement_signed notifications (keep earliest per user + doc type)
DELETE FROM user_notifications
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY user_id, notification_type, (metadata->>'document_type')
      ORDER BY created_at ASC
    ) as rn
    FROM user_notifications
    WHERE notification_type = 'agreement_signed'
  ) sub
  WHERE rn > 1
);

-- Clean up duplicate system messages about signing (keep earliest per connection + doc type)
DELETE FROM connection_messages
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY connection_request_id, 
        CASE WHEN body LIKE '%NDA%' THEN 'nda' WHEN body LIKE '%Fee Agreement%' THEN 'fee' ELSE 'other' END
      ORDER BY created_at ASC
    ) as rn
    FROM connection_messages
    WHERE message_type = 'system'
      AND body LIKE '%has been signed%'
  ) sub
  WHERE rn > 1
);
