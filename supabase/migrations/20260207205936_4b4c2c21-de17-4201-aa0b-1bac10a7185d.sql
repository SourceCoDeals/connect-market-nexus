-- Fix Richie Collision: correct mis-parsed state code from "HA" to "MS" (Mississippi)
UPDATE public.listings 
SET address_state = 'MS',
    geographic_states = ARRAY['MS']
WHERE id = 'f129ebd8-5ecd-453e-a1bb-5ec26acfa143' 
  AND address_state = 'HA';