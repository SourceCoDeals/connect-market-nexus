-- Step A: Clear the slug from the internal/private listing so the public one can claim it
-- (unique constraint on listings.webflow_slug requires moving, not duplicating)
UPDATE public.listings
SET webflow_slug = NULL
WHERE id = 'd136656a-433e-47fe-8813-f711eedfddab'
  AND webflow_slug = 'florida-property-damage-restoration-emergency-services';

-- Step B: Assign the slug to the public marketplace listing so future Webflow
-- form submissions on this page bind to the correct buyer-facing record
UPDATE public.listings
SET webflow_slug = 'florida-property-damage-restoration-emergency-services'
WHERE id = 'd543b05b-2649-4327-a1dd-2a2589e73427';

-- Step C: Repoint Brendan Doney's existing connection request from the internal
-- listing to the public marketplace listing
UPDATE public.connection_requests
SET listing_id = 'd543b05b-2649-4327-a1dd-2a2589e73427'
WHERE id = '83f6af12-1950-46f1-bcfb-d4f5423711eb'
  AND listing_id = 'd136656a-433e-47fe-8813-f711eedfddab';