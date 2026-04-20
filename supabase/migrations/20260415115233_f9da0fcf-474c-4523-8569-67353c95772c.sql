-- Delete firm_members referencing test connection requests
DELETE FROM firm_members WHERE connection_request_id IN (
  '9478857e-cf53-4cb2-acc5-36b688f8018b',
  '7544c0a7-ad0f-4da2-b95f-89875bc08364',
  '78b4b1b3-1ece-4dd9-8b9d-273a222c75fa',
  'e828ae7c-b41e-4342-9512-538f1652e9c6',
  'cc1a2ba9-b4e4-4afa-a618-f2cd35f64149',
  'b9a74893-8d47-4d84-af75-60822f3fcf78',
  'b2d2b7ad-49e5-4365-b2b8-a72af852c23c',
  '01a1398f-1a7a-4af4-9fa9-587786cf331e',
  '5eb826a6-b7f3-404a-b231-0559fda5d717',
  '8a241601-9579-4cee-8693-fa7cbc39cd16',
  '6444f74c-df8d-4e6b-9a85-15145183eb37'
);

-- Delete test connection requests
DELETE FROM connection_requests WHERE id IN (
  '9478857e-cf53-4cb2-acc5-36b688f8018b',
  '7544c0a7-ad0f-4da2-b95f-89875bc08364',
  '78b4b1b3-1ece-4dd9-8b9d-273a222c75fa',
  'e828ae7c-b41e-4342-9512-538f1652e9c6',
  'cc1a2ba9-b4e4-4afa-a618-f2cd35f64149',
  'b9a74893-8d47-4d84-af75-60822f3fcf78',
  'b2d2b7ad-49e5-4365-b2b8-a72af852c23c',
  '01a1398f-1a7a-4af4-9fa9-587786cf331e',
  '5eb826a6-b7f3-404a-b231-0559fda5d717',
  '8a241601-9579-4cee-8693-fa7cbc39cd16',
  '6444f74c-df8d-4e6b-9a85-15145183eb37'
);

-- Delete orphaned test firm_agreements
DELETE FROM firm_agreements WHERE id IN (
  'a5effdf8-4fb1-45f5-b689-0bb40a1dece4',
  '6adfd593-a1f2-4835-a03a-cdc53a8ad5f5',
  '7327d5cf-4a5b-4549-ac99-61152e009674',
  '09086765-adc9-401b-9c18-b577258877a4',
  'c9416789-34b6-45f4-b389-3aade2e590b9',
  'fa74620a-3f13-4c6f-b63b-cd8bf6772aae',
  '2ca18b40-0c67-43ac-bad4-4624d8e6f18a',
  'd2c42116-717f-4df0-92df-b34401fc16f9',
  '6fbe999d-596d-4e63-a383-c75490325f5c',
  'c9dde67f-899d-4f12-b0c8-77dd20ce8807',
  '21a58e5f-f9aa-41b5-8642-1f73e7cfe3a2'
);