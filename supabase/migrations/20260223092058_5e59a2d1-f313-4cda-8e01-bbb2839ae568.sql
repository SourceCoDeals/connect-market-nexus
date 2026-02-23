-- The trigger_auto_create_deal_from_request fires on INSERT to connection_requests
-- and tries to find a 'New Inquiry' stage which no longer exists (pipeline restructured).
-- This causes: "null value in column stage_id of relation deals violates not-null constraint"
-- 
-- Deals should only be created on approval (handled by trg_create_deal_on_request_approval).
-- Drop the broken INSERT trigger.

DROP TRIGGER IF EXISTS trigger_auto_create_deal_from_request ON public.connection_requests;
DROP FUNCTION IF EXISTS public.auto_create_deal_from_connection_request();