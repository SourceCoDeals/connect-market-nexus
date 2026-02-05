-- Fix RLS policy for ma_guide_generations to handle NULL created_by
-- The current policy fails when remarketing_buyer_universes.created_by is NULL

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own universe generations" ON ma_guide_generations;

-- Create a more permissive SELECT policy that:
-- 1. Allows viewing if user created the universe (original behavior)
-- 2. Allows viewing if user is an admin
-- 3. Allows viewing if created_by is NULL (legacy data / admin-created universes)
CREATE POLICY "Users can view universe generations" ON ma_guide_generations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM remarketing_buyer_universes ru
    WHERE ru.id = ma_guide_generations.universe_id
    AND (
      ru.created_by = auth.uid()
      OR ru.created_by IS NULL
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    )
  )
);

-- Also fix UPDATE policy for same reason
DROP POLICY IF EXISTS "Users can update guide generations" ON ma_guide_generations;

CREATE POLICY "Users can update universe generations" ON ma_guide_generations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM remarketing_buyer_universes ru
    WHERE ru.id = ma_guide_generations.universe_id
    AND (
      ru.created_by = auth.uid()
      OR ru.created_by IS NULL
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    )
  )
);

-- Fix INSERT policy too
DROP POLICY IF EXISTS "Users can insert guide generations" ON ma_guide_generations;

CREATE POLICY "Users can insert universe generations" ON ma_guide_generations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM remarketing_buyer_universes ru
    WHERE ru.id = ma_guide_generations.universe_id
    AND (
      ru.created_by = auth.uid()
      OR ru.created_by IS NULL
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    )
  )
);