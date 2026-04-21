
-- Insert 3 missing Webflow leads with firm_id pre-populated to avoid trigger conflict
INSERT INTO public.connection_requests (
  source, status, listing_id, firm_id,
  lead_name, lead_email, lead_company, lead_role, lead_phone,
  user_message, source_metadata, created_at
) VALUES
(
  'webflow', 'pending', 'f2bcd91c-3654-43b5-800c-1590523afd2e', '03e6434a-d35d-41a1-b369-2fcb3a6264d9',
  'Jacob Jackson', 'jjackson@surgepe.com', 'Surge Private Equity', 'Private Equity', '(469) 215-9446',
  'The company meets our standards as a founder owned with a diversified customer base. We are interested in learning more about the deal if you can send the NDA, or other details.',
  '{"webflow_slug": "netconversion", "ip_address": "104.184.116.195", "submitted_at": "2026-04-15T16:06:50-05:00", "manually_backfilled": true, "backfill_reason": "webhook_delivery_failure"}'::jsonb,
  '2026-04-15T16:06:50-05:00'::timestamptz
),
(
  'webflow', 'pending', '2b8b872b-6fc1-4511-a3ce-8c283c2ed5a4', '03e6434a-d35d-41a1-b369-2fcb3a6264d9',
  'Jacob Jackson', 'jjackson@surgepe.com', 'Surge Private Equity', 'Private Equity', '(469) 215-9446',
  'This deal is locally owned and Texas based. Surge is based in Texas and is interested in getting into the plumbing industry locally.',
  '{"webflow_slug": "mustang-plumbing", "ip_address": "104.184.116.195", "submitted_at": "2026-04-15T16:15:22-05:00", "manually_backfilled": true, "backfill_reason": "webhook_delivery_failure"}'::jsonb,
  '2026-04-15T16:15:22-05:00'::timestamptz
),
(
  'webflow', 'pending', 'a6e20eba-768b-43bb-97ea-ddb6e679fe73', '58963857-c1b8-40bb-9fc2-e67271579a47',
  'Matt cole', 'matt@sbjcap.com', 'SBJ Capital', 'Private Equity', '(415) 848-1994',
  'Field services and compliance oriented business services are a core area of focus for us.',
  '{"webflow_slug": "saks-metering", "ip_address": "174.239.160.11", "submitted_at": "2026-04-15T00:21:41-05:00", "manually_backfilled": true, "backfill_reason": "webhook_delivery_failure"}'::jsonb,
  '2026-04-15T00:21:41-05:00'::timestamptz
);
