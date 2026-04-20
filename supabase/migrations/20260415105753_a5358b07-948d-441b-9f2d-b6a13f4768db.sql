
INSERT INTO connection_requests (
  id, listing_id, status, source, source_metadata,
  lead_email, lead_name, lead_company, lead_role,
  lead_agreement_email_status, lead_agreement_email_sent_at,
  user_message, created_at
) VALUES
(
  gen_random_uuid(),
  '0bf4531e-6910-41a4-9f07-150f4600e439',
  'pending', 'webflow',
  '{"form_name": "Deal Request Form", "test_record": true}'::jsonb,
  'jane@testemailsent-cap.com', 'Jane Smith (Email Sent)', 'EmailSent Capital Partners', 'Managing Director',
  'sent', now() - interval '2 hours',
  'Interested in learning more about this opportunity.',
  now() - interval '2 hours'
),
(
  gen_random_uuid(),
  '0bf4531e-6910-41a4-9f07-150f4600e439',
  'pending', 'webflow',
  '{"form_name": "Deal Request Form", "test_record": true}'::jsonb,
  'mark@testalreadycovered-llc.com', 'Mark Johnson (Already Covered)', 'AlreadyCovered LLC', 'Partner',
  'already_covered', NULL,
  'We would like to review the materials for this deal.',
  now() - interval '1 hour'
),
(
  gen_random_uuid(),
  '0bf4531e-6910-41a4-9f07-150f4600e439',
  'pending', 'webflow',
  '{"form_name": "Deal Request Form", "test_record": true}'::jsonb,
  'sarah@testawaitingsend-corp.com', 'Sarah Lee (Awaiting Send)', 'AwaitingSend Corp', 'VP Corp Dev',
  NULL, NULL,
  'Please send us the NDA and fee agreement.',
  now() - interval '30 minutes'
),
(
  gen_random_uuid(),
  '0bf4531e-6910-41a4-9f07-150f4600e439',
  'pending', 'webflow',
  '{"form_name": "Deal Request Form", "test_record": true, "is_duplicate": true}'::jsonb,
  'tom@testduplicate-inc.com', 'Tom Brown (Duplicate)', 'Duplicate Submissions Inc', 'Analyst',
  'duplicate_skipped', NULL,
  'Submitting again just in case.',
  now() - interval '15 minutes'
);
