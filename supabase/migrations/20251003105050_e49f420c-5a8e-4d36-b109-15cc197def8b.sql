-- Activate Closed Won and Under Contract stages
UPDATE deal_stages 
SET is_active = true,
    updated_at = now()
WHERE name IN ('Closed Won', 'Under Contract');