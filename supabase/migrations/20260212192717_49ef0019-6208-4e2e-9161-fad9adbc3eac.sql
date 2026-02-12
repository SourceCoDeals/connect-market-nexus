-- Set sequence far past any possible existing identifier to avoid collisions
SELECT setval('public.deal_identifier_seq', 50000, true);