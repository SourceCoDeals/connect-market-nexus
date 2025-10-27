
-- Create trigger for auto-linking inbound leads to firms
DROP TRIGGER IF EXISTS auto_link_lead_to_firm_trigger ON inbound_leads;
CREATE TRIGGER auto_link_lead_to_firm_trigger
  BEFORE INSERT OR UPDATE ON inbound_leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_lead_to_firm();

-- Create trigger for syncing connection request firms  
DROP TRIGGER IF EXISTS sync_connection_request_firm_trigger ON connection_requests;
CREATE TRIGGER sync_connection_request_firm_trigger
  BEFORE INSERT OR UPDATE ON connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_connection_request_firm();
