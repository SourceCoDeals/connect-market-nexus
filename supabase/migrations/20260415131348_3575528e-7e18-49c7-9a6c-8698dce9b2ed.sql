
-- Delete dependent firm_members referencing test connection requests
DELETE FROM public.firm_members
WHERE connection_request_id IN (
  '6270fa15-4f14-4ebf-b0e5-8fa6eb881f05',
  '31013402-faf5-4ed8-bc48-20b9ab6f925c',
  'a650971b-9349-4649-bfcb-9ffcff921073',
  '977bd36c-6e60-4ef5-ad93-bf9748f06677'
);

-- Now delete the test connection requests
DELETE FROM public.connection_requests
WHERE id IN (
  '6270fa15-4f14-4ebf-b0e5-8fa6eb881f05',
  '31013402-faf5-4ed8-bc48-20b9ab6f925c',
  'a650971b-9349-4649-bfcb-9ffcff921073',
  '977bd36c-6e60-4ef5-ad93-bf9748f06677'
);
