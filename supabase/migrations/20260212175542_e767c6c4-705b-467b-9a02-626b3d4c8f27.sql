-- Fix P0: Clean up existing bad data from old sync runs
-- 1) Fix status: captarget_review → pending
UPDATE listings 
SET status = 'pending' 
WHERE deal_source = 'captarget' AND status = 'captarget_review';

-- 2) Fix dummy defaults: revenue=0 and ebitda=0 → NULL
UPDATE listings 
SET revenue = NULL 
WHERE deal_source = 'captarget' AND revenue = 0;

UPDATE listings 
SET ebitda = NULL 
WHERE deal_source = 'captarget' AND ebitda = 0;