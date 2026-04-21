-- Fix created_at timestamps for 7 backfilled valuation_calculator leads
-- These were ingested on 2026-04-16 but have original submission dates from the CSV

UPDATE valuation_leads SET created_at = '2026-04-13 19:43:00.527475+00', updated_at = '2026-04-13 19:43:00.527475+00'
WHERE id = 'b467cbf1-c1ac-4738-92bc-cc52b082cb34';

UPDATE valuation_leads SET created_at = '2026-03-15 20:18:42.370498+00', updated_at = '2026-03-15 20:18:42.370498+00'
WHERE id = '22d27802-a068-4806-b3c7-20d81c0fc0a9';

UPDATE valuation_leads SET created_at = '2026-03-15 20:15:20.955498+00', updated_at = '2026-03-15 20:15:20.955498+00'
WHERE id = 'dedfa220-3132-40bb-8578-01eb9f20bfb2';

UPDATE valuation_leads SET created_at = '2026-03-11 09:34:49.710122+00', updated_at = '2026-03-11 09:34:49.710122+00'
WHERE id = '9b5454ce-abed-4e83-90f5-55351e84ee82';

UPDATE valuation_leads SET created_at = '2026-03-10 21:55:52.247498+00', updated_at = '2026-03-10 21:55:52.247498+00'
WHERE id = '9c8dcb71-0638-43a1-9d4b-be2c52270b57';

UPDATE valuation_leads SET created_at = '2025-12-22 12:12:45.870498+00', updated_at = '2025-12-22 12:12:45.870498+00'
WHERE id = '893efb37-b92d-443c-bd81-f0953a246428';

UPDATE valuation_leads SET created_at = '2025-11-26 23:52:41.338498+00', updated_at = '2025-11-26 23:52:41.338498+00'
WHERE id = 'f5ce2a7b-efa6-4f5a-b08c-b369c158b806';