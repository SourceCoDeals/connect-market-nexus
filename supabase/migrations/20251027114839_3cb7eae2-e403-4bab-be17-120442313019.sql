
-- Create trigger for auto-linking inbound leads to firms
CREATE OR REPLACE TRIGGER auto_link_lead_to_firm_trigger
  BEFORE INSERT OR UPDATE ON inbound_leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_lead_to_firm();

-- Create trigger for syncing connection request firms
CREATE OR REPLACE TRIGGER sync_connection_request_firm_trigger
  BEFORE INSERT OR UPDATE ON connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_connection_request_firm();
