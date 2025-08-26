-- Migrate profiles.investment_size from text to jsonb array with safe backfill
BEGIN;

-- 1) Add new jsonb column with default empty array (keep nullable to preserve semantics)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS investment_size_new jsonb DEFAULT '[]'::jsonb;

-- 2) Backfill data safely
-- Handles cases:
--  - NULL or empty -> []
--  - JSON array string -> cast to jsonb
--  - Comma-separated values -> split, trim, array -> jsonb
--  - Single scalar string -> [value]
WITH src AS (
  SELECT 
    id,
    NULLIF(trim(investment_size), '') AS val
  FROM public.profiles
)
UPDATE public.profiles p
SET investment_size_new = (
  CASE
    WHEN s.val IS NULL THEN '[]'::jsonb
    WHEN s.val ~ '^\s*\[.*\]\s*$' THEN 
      -- Looks like a JSON array; try to cast, fallback to single-item array on failure
      COALESCE(
        (CASE WHEN s.val ~ '^\s*\[\s*\]\s*$' THEN '[]'::jsonb ELSE s.val::jsonb END),
        to_jsonb(ARRAY[s.val])
      )
    WHEN position(',' in s.val) > 0 THEN 
      to_jsonb(ARRAY(
        SELECT btrim(x)
        FROM unnest(string_to_array(s.val, ',')) AS x
        WHERE btrim(x) <> ''
      ))
    ELSE 
      to_jsonb(ARRAY[s.val])
  END
)
FROM src s
WHERE p.id = s.id;

-- 3) Drop old column and rename new one
ALTER TABLE public.profiles DROP COLUMN investment_size;
ALTER TABLE public.profiles RENAME COLUMN investment_size_new TO investment_size;

-- 4) Ensure default remains correct
ALTER TABLE public.profiles ALTER COLUMN investment_size SET DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.investment_size IS 'Array of investment size ranges selected by the user (jsonb array of text)';

COMMIT;