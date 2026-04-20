UPDATE connection_requests SET lead_agreement_outbound_id = NULL WHERE id = '34227836-e1b3-455a-a11b-f9a05773a0b6';
DELETE FROM outbound_emails WHERE metadata->>'connectionRequestId' = '34227836-e1b3-455a-a11b-f9a05773a0b6';
DELETE FROM connection_requests WHERE id = '34227836-e1b3-455a-a11b-f9a05773a0b6';