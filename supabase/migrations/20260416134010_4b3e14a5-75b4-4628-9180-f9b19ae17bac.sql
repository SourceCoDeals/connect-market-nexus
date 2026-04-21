
-- Step 1: Copy useful flags from excluded initial_import duplicates to the new valuation_calculator records
UPDATE valuation_leads new_lead
SET
  lead_score = COALESCE(new_lead.lead_score, old_lead.lead_score),
  scoring_notes = COALESCE(new_lead.scoring_notes, old_lead.scoring_notes),
  status = COALESCE(new_lead.status, old_lead.status),
  pushed_to_all_deals = COALESCE(new_lead.pushed_to_all_deals, old_lead.pushed_to_all_deals),
  pushed_to_all_deals_at = COALESCE(new_lead.pushed_to_all_deals_at, old_lead.pushed_to_all_deals_at),
  pushed_listing_id = COALESCE(new_lead.pushed_listing_id, old_lead.pushed_listing_id),
  is_priority_target = COALESCE(new_lead.is_priority_target, old_lead.is_priority_target),
  needs_buyer_search = COALESCE(new_lead.needs_buyer_search, old_lead.needs_buyer_search),
  needs_buyer_universe = COALESCE(new_lead.needs_buyer_universe, old_lead.needs_buyer_universe),
  need_to_contact_owner = COALESCE(new_lead.need_to_contact_owner, old_lead.need_to_contact_owner),
  needs_owner_contact = COALESCE(new_lead.needs_owner_contact, old_lead.needs_owner_contact),
  deal_owner_id = COALESCE(new_lead.deal_owner_id, old_lead.deal_owner_id),
  updated_at = now()
FROM valuation_leads old_lead
WHERE lower(new_lead.email) = lower(old_lead.email)
  AND new_lead.lead_source = 'valuation_calculator'
  AND old_lead.lead_source = 'initial_import'
  AND old_lead.excluded = true
  AND new_lead.calculator_type = 'general'
  AND old_lead.calculator_type = 'general';

-- Step 2: Delete the old excluded initial_import duplicates
DELETE FROM valuation_leads old_lead
USING valuation_leads new_lead
WHERE lower(old_lead.email) = lower(new_lead.email)
  AND old_lead.lead_source = 'initial_import'
  AND old_lead.excluded = true
  AND new_lead.lead_source = 'valuation_calculator'
  AND old_lead.calculator_type = 'general'
  AND new_lead.calculator_type = 'general';
