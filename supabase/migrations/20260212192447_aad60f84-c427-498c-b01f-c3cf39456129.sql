-- Reset the deal_identifier_seq to be past the max existing identifier number
-- Current max is SCO-2026-278, so the numeric part is 278
-- Set sequence to start at 1000 to leave plenty of room
SELECT setval('public.deal_identifier_seq', 1000, true);

-- Also grant usage to authenticated and service_role to prevent permission issues
GRANT USAGE, SELECT ON SEQUENCE public.deal_identifier_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.deal_identifier_seq TO service_role;