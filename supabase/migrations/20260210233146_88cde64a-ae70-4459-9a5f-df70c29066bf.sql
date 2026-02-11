
-- Clear FK references first, then delete all buyers from Accounting universe
DELETE FROM buyer_enrichment_queue WHERE buyer_id IN (SELECT id FROM remarketing_buyers WHERE universe_id = '21eece85-c0ab-4b2e-a8cd-038211a64a96');

DELETE FROM remarketing_buyers WHERE universe_id = '21eece85-c0ab-4b2e-a8cd-038211a64a96';
