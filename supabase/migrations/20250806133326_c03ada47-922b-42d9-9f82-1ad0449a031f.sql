-- Remove ALL triggers that might be interfering
DROP TRIGGER IF EXISTS send_deal_alerts_on_new_listing ON listings;
DROP TRIGGER IF EXISTS trigger_deal_alerts ON listings;