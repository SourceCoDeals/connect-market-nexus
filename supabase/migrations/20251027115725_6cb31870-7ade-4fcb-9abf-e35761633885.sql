
-- CRITICAL FIX: Actually create the triggers that were missing
-- The trigger names in the original migration had inconsistent names

-- Drop any existing triggers first
DROP TRIGGER IF EXISTS link_lead_to_firm_trigger ON inbound_leads;
DROP TRIGGER IF EXISTS auto_link_lead_to_firm_trigger ON inbound_leads;

-- Create the correct trigger for inbound_leads
CREATE TRIGGER auto_link_lead_to_firm_trigger
  BEFORE INSERT OR UPDATE ON inbound_leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_lead_to_firm();

-- Drop any existing triggers for connection_requests
DROP TRIGGER IF EXISTS sync_connection_request_firm_trigger ON connection_requests;

-- Create the correct trigger for connection_requests
CREATE TRIGGER sync_connection_request_firm_trigger
  BEFORE INSERT OR UPDATE ON connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_connection_request_firm();
