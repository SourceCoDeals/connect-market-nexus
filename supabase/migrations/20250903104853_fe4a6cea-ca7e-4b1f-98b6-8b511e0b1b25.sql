-- Update deals with realistic stage distribution and time variation
UPDATE deals 
SET 
  stage_entered_at = created_at + 
    CASE 
      WHEN RANDOM() < 0.3 THEN INTERVAL '1 day' * FLOOR(RANDOM() * 3)  -- 30% recent (0-2 days)
      WHEN RANDOM() < 0.6 THEN INTERVAL '1 day' * FLOOR(RANDOM() * 7 + 3)  -- 30% medium (3-9 days)
      ELSE INTERVAL '1 day' * FLOOR(RANDOM() * 21 + 10)  -- 40% older (10-30 days)
    END,
  buyer_priority_score = 
    CASE 
      WHEN RANDOM() < 0.2 THEN FLOOR(RANDOM() * 20 + 80)  -- 20% high priority (80-100)
      WHEN RANDOM() < 0.6 THEN FLOOR(RANDOM() * 30 + 40)  -- 40% medium priority (40-70)
      ELSE FLOOR(RANDOM() * 40 + 10)  -- 40% lower priority (10-50)
    END,
  nda_status = 
    CASE 
      WHEN RANDOM() < 0.15 THEN 'signed'
      WHEN RANDOM() < 0.35 THEN 'sent'
      WHEN RANDOM() < 0.05 THEN 'declined'
      ELSE 'not_sent'
    END,
  fee_agreement_status = 
    CASE 
      WHEN RANDOM() < 0.08 THEN 'signed'
      WHEN RANDOM() < 0.20 THEN 'sent'
      WHEN RANDOM() < 0.03 THEN 'declined'
      ELSE 'not_sent'
    END
WHERE id IS NOT NULL;