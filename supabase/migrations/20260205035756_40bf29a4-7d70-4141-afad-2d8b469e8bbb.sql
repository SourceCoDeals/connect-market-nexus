-- Clear MA guide content for the Restoration universe
UPDATE remarketing_buyer_universes 
SET ma_guide_content = NULL, updated_at = now()
WHERE id = 'f32fb7a5-e01e-4b0e-a3bf-125f8c01dc81';

-- Also clear any generation state to start fresh
DELETE FROM remarketing_guide_generation_state 
WHERE universe_id = 'f32fb7a5-e01e-4b0e-a3bf-125f8c01dc81';