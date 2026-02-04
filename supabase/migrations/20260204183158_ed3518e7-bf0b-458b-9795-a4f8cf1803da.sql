-- Add missing RLS policies for INSERT and UPDATE (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ma_guide_generations' AND policyname = 'Users can insert guide generations') THEN
    CREATE POLICY "Users can insert guide generations"
      ON ma_guide_generations
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM remarketing_buyer_universes u
          WHERE u.id = ma_guide_generations.universe_id
          AND u.created_by = auth.uid()
        )
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ma_guide_generations' AND policyname = 'Users can update guide generations') THEN
    CREATE POLICY "Users can update guide generations"
      ON ma_guide_generations
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM remarketing_buyer_universes u
          WHERE u.id = ma_guide_generations.universe_id
          AND u.created_by = auth.uid()
        )
      );
  END IF;
END
$$;